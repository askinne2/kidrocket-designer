/**
 * Simulation Repository
 * 
 * Data access layer for simulation results and telemetry data.
 */

import { DatabaseService } from '../../../infrastructure/database/database.service';
import { 
  SimulationResult, 
  SimulationListResponse,
  TrajectoryPoint,
  LaunchOptions,
  WeatherConditions,
  FlightResults
} from '../../../shared/types/rocket';

export class SimulationRepository {
  constructor(private db: DatabaseService) {}

  /**
   * Save simulation result with telemetry data
   */
  async create(data: {
    rocketId: string;
    userId: string;
    config: any; // RocketConfig snapshot
    results: FlightResults;
    telemetry: TrajectoryPoint[];
    weather: WeatherConditions;
    launchOptions?: LaunchOptions;
  }): Promise<SimulationResult> {
    const client = await this.db.getClient();
    
    try {
      await client.query('BEGIN');

      // Insert simulation record
      const simulationQuery = `
        INSERT INTO simulations (
          rocket_id, user_id, rocket_config, results, weather, 
          launch_options, max_altitude, max_velocity, flight_time, 
          successful, score
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id, rocket_id, user_id, rocket_config, results, 
                  weather, launch_options, max_altitude, max_velocity, 
                  flight_time, successful, score, created_at
      `;

      const simulationValues = [
        data.rocketId,
        data.userId,
        JSON.stringify(data.config),
        JSON.stringify(data.results),
        JSON.stringify(data.weather),
        data.launchOptions ? JSON.stringify(data.launchOptions) : null,
        data.results.maxAltitude,
        data.results.maxVelocity,
        data.results.flightTime,
        data.results.successful,
        data.results.score
      ];

      const simulationResult = await client.query(simulationQuery, simulationValues);
      const simulation = simulationResult.rows[0];

      // Insert telemetry data if provided
      if (data.telemetry && data.telemetry.length > 0) {
        const telemetryQuery = `
          INSERT INTO simulation_telemetry (
            simulation_id, telemetry_data, time_step, total_points
          )
          VALUES ($1, $2, $3, $4)
        `;

        const timeStep = data.telemetry.length > 1 
          ? data.telemetry[1].time - data.telemetry[0].time 
          : 0.1;

        await client.query(telemetryQuery, [
          simulation.id,
          JSON.stringify(data.telemetry),
          timeStep,
          data.telemetry.length
        ]);
      }

      await client.query('COMMIT');

      return this.mapRowToSimulation(simulation, data.telemetry);
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`Failed to create simulation: ${error.message}`);
    } finally {
      client.release();
    }
  }

  /**
   * Find simulation by ID
   */
  async findById(id: string, includeTelemetry: boolean = false): Promise<SimulationResult | null> {
    let query = `
      SELECT 
        s.id, s.rocket_id, s.user_id, s.rocket_config, s.results,
        s.weather, s.launch_options, s.created_at
      FROM simulations s
      WHERE s.id = $1
    `;

    try {
      const result = await this.db.query(query, [id]);
      if (result.rows.length === 0) {
        return null;
      }

      const simulation = result.rows[0];
      let telemetry: TrajectoryPoint[] = [];

      if (includeTelemetry) {
        const telemetryQuery = `
          SELECT telemetry_data 
          FROM simulation_telemetry 
          WHERE simulation_id = $1
        `;
        const telemetryResult = await this.db.query(telemetryQuery, [id]);
        if (telemetryResult.rows.length > 0) {
          telemetry = JSON.parse(telemetryResult.rows[0].telemetry_data);
        }
      }

      return this.mapRowToSimulation(simulation, telemetry);
    } catch (error) {
      throw new Error(`Failed to find simulation: ${error.message}`);
    }
  }

  /**
   * Find simulations by rocket ID
   */
  async findByRocketId(rocketId: string, options: {
    page?: number;
    limit?: number;
    includeTelemetry?: boolean;
  } = {}): Promise<SimulationListResponse> {
    const { page = 1, limit = 20, includeTelemetry = false } = options;

    // Count query
    const countQuery = `
      SELECT COUNT(*) as total
      FROM simulations
      WHERE rocket_id = $1
    `;

    // Data query
    const dataQuery = `
      SELECT 
        s.id, s.rocket_id, s.user_id, s.rocket_config, s.results,
        s.weather, s.launch_options, s.created_at
      FROM simulations s
      WHERE s.rocket_id = $1
      ORDER BY s.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    try {
      const [countResult, dataResult] = await Promise.all([
        this.db.query(countQuery, [rocketId]),
        this.db.query(dataQuery, [rocketId, limit, (page - 1) * limit])
      ]);

      const total = parseInt(countResult.rows[0].total, 10);
      const simulations: SimulationResult[] = [];

      // Process each simulation
      for (const row of dataResult.rows) {
        let telemetry: TrajectoryPoint[] = [];

        if (includeTelemetry) {
          const telemetryQuery = `
            SELECT telemetry_data 
            FROM simulation_telemetry 
            WHERE simulation_id = $1
          `;
          const telemetryResult = await this.db.query(telemetryQuery, [row.id]);
          if (telemetryResult.rows.length > 0) {
            telemetry = JSON.parse(telemetryResult.rows[0].telemetry_data);
          }
        }

        simulations.push(this.mapRowToSimulation(row, telemetry));
      }

      return {
        simulations,
        total,
        page,
        limit
      };
    } catch (error) {
      throw new Error(`Failed to find simulations by rocket: ${error.message}`);
    }
  }

  /**
   * Find simulations by user ID
   */
  async findByUserId(userId: string, options: {
    page?: number;
    limit?: number;
    successful?: boolean;
  } = {}): Promise<SimulationListResponse> {
    const { page = 1, limit = 20, successful } = options;

    let whereConditions = ['user_id = $1'];
    let queryParams: any[] = [userId];
    let paramCount = 1;

    if (successful !== undefined) {
      whereConditions.push(`successful = $${++paramCount}`);
      queryParams.push(successful);
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    // Count query
    const countQuery = `
      SELECT COUNT(*) as total
      FROM simulations
      ${whereClause}
    `;

    // Data query
    const dataQuery = `
      SELECT 
        s.id, s.rocket_id, s.user_id, s.rocket_config, s.results,
        s.weather, s.launch_options, s.created_at
      FROM simulations s
      ${whereClause}
      ORDER BY s.created_at DESC
      LIMIT $${++paramCount} OFFSET $${++paramCount}
    `;

    queryParams.push(limit, (page - 1) * limit);

    try {
      const [countResult, dataResult] = await Promise.all([
        this.db.query(countQuery, queryParams.slice(0, -2)),
        this.db.query(dataQuery, queryParams)
      ]);

      const total = parseInt(countResult.rows[0].total, 10);
      const simulations = dataResult.rows.map(row => 
        this.mapRowToSimulation(row, []) // No telemetry for list view
      );

      return {
        simulations,
        total,
        page,
        limit
      };
    } catch (error) {
      throw new Error(`Failed to find simulations by user: ${error.message}`);
    }
  }

  /**
   * Get leaderboard data (best performing simulations)
   */
  async getLeaderboard(options: {
    metric?: 'max_altitude' | 'max_velocity' | 'score';
    limit?: number;
    timeframe?: 'day' | 'week' | 'month' | 'all';
  } = {}): Promise<Array<{
    simulation: SimulationResult;
    rocketName: string;
    userName: string;
  }>> {
    const { metric = 'max_altitude', limit = 10, timeframe = 'all' } = options;

    let timeCondition = '';
    const queryParams: any[] = [];
    let paramCount = 0;

    if (timeframe !== 'all') {
      const intervals = {
        day: '1 day',
        week: '1 week',
        month: '1 month'
      };
      timeCondition = `AND s.created_at >= NOW() - INTERVAL '${intervals[timeframe]}'`;
    }

    const query = `
      SELECT 
        s.id, s.rocket_id, s.user_id, s.rocket_config, s.results,
        s.weather, s.launch_options, s.created_at,
        r.name as rocket_name,
        u.username as user_name
      FROM simulations s
      JOIN rockets r ON s.rocket_id = r.id
      JOIN users u ON s.user_id = u.id
      WHERE s.successful = true ${timeCondition}
      ORDER BY s.${metric} DESC
      LIMIT $${++paramCount}
    `;

    queryParams.push(limit);

    try {
      const result = await this.db.query(query, queryParams);
      
      return result.rows.map(row => ({
        simulation: this.mapRowToSimulation(row, []),
        rocketName: row.rocket_name,
        userName: row.user_name
      }));
    } catch (error) {
      throw new Error(`Failed to get leaderboard: ${error.message}`);
    }
  }

  /**
   * Delete simulation and its telemetry data
   */
  async delete(id: string, userId: string): Promise<boolean> {
    const client = await this.db.getClient();

    try {
      await client.query('BEGIN');

      // Delete telemetry data first (due to foreign key)
      await client.query('DELETE FROM simulation_telemetry WHERE simulation_id = $1', [id]);

      // Delete simulation record
      const result = await client.query(
        'DELETE FROM simulations WHERE id = $1 AND user_id = $2',
        [id, userId]
      );

      await client.query('COMMIT');

      return result.rowCount > 0;
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`Failed to delete simulation: ${error.message}`);
    } finally {
      client.release();
    }
  }

  /**
   * Get simulation statistics for a user
   */
  async getUserStats(userId: string): Promise<{
    totalSimulations: number;
    successfulSimulations: number;
    bestAltitude: number;
    bestVelocity: number;
    averageScore: number;
  }> {
    const query = `
      SELECT 
        COUNT(*) as total_simulations,
        COUNT(*) FILTER (WHERE successful = true) as successful_simulations,
        MAX(max_altitude) as best_altitude,
        MAX(max_velocity) as best_velocity,
        AVG(score) FILTER (WHERE successful = true) as average_score
      FROM simulations
      WHERE user_id = $1
    `;

    try {
      const result = await this.db.query(query, [userId]);
      const row = result.rows[0];

      return {
        totalSimulations: parseInt(row.total_simulations, 10) || 0,
        successfulSimulations: parseInt(row.successful_simulations, 10) || 0,
        bestAltitude: parseFloat(row.best_altitude) || 0,
        bestVelocity: parseFloat(row.best_velocity) || 0,
        averageScore: parseFloat(row.average_score) || 0
      };
    } catch (error) {
      throw new Error(`Failed to get user stats: ${error.message}`);
    }
  }

  /**
   * Map database row to SimulationResult object
   */
  private mapRowToSimulation(row: any, telemetry: TrajectoryPoint[] = []): SimulationResult {
    return {
      id: row.id,
      rocketId: row.rocket_id,
      userId: row.user_id,
      config: typeof row.rocket_config === 'string' ? JSON.parse(row.rocket_config) : row.rocket_config,
      results: typeof row.results === 'string' ? JSON.parse(row.results) : row.results,
      telemetry,
      weather: typeof row.weather === 'string' ? JSON.parse(row.weather) : row.weather,
      createdAt: row.created_at
    };
  }
}
