# 🚀 KidRocket Designer - Deployment Guide

## 🌐 **Live Demo Setup for Family Sharing**

### **Quick Setup (5 minutes)**

#### **Step 1: Deploy Frontend to GitHub Pages**

1. **Update your GitHub username** in `client/package.json`:
   ```json
   "homepage": "https://YOUR_GITHUB_USERNAME.github.io/kidrocket-designer"
   ```

2. **Deploy to GitHub Pages**:
   ```bash
   cd client
   npm run deploy
   ```

3. **Enable GitHub Pages**:
   - Go to your GitHub repo → Settings → Pages
   - Source: Deploy from a branch
   - Branch: `gh-pages` / `root`
   - Save

**Your frontend will be live at**: `https://YOUR_USERNAME.github.io/kidrocket-designer`

#### **Step 2: Deploy Backend to Render.com (Free)**

1. **Go to**: https://render.com (sign up with GitHub)

2. **Create New Web Service**:
   - Connect your `kidrocket-designer` repo
   - Name: `kidrocket-designer-api`
   - Environment: `Node`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
   - Plan: **Free** (0$/month)

3. **Add Environment Variables**:
   ```
   NODE_ENV=production
   PORT=10000
   ```

4. **Deploy** - Render will give you a URL like:
   `https://kidrocket-designer-api.onrender.com`

#### **Step 3: Connect Frontend to Backend**

Update your frontend API calls to point to your Render backend URL.

In `client/src/api/rocketApi.ts`, change the base URL:
```typescript
const API_BASE_URL = 'https://your-app-name.onrender.com';
```

Redeploy frontend:
```bash
cd client
npm run deploy
```

---

## 🎯 **Alternative: Frontend-Only Demo (Fastest)**

For the quickest family demo, you can deploy just the frontend with mock data:

1. **Modify API calls** to return mock simulation data
2. **Deploy to GitHub Pages** immediately
3. **Share link** - works instantly!

This gives your family the full UI experience without needing backend hosting.

---

## 💰 **Hosting Costs**

- **GitHub Pages**: FREE ✅
- **Render.com Free Tier**: FREE ✅ (sleeps after 15min inactivity)
- **Total Monthly Cost**: $0

**Free tier limitations**:
- Backend "sleeps" after 15 minutes of inactivity (30-second cold start)
- Perfect for family demos and sharing!

---

## 🔧 **Other Free Options**

### **All-in-One Platforms**
- **Vercel**: Free tier, great for React + serverless functions
- **Netlify**: Free tier, excellent for static sites + serverless
- **Railway**: Free tier, good for full-stack apps

### **Backend Only**
- **Cyclic**: Free Node.js hosting
- **Fly.io**: Free tier with global deployment

---

## 🚀 **Production Upgrade Path**

When ready for serious use:
- **Render Pro**: $7/month (no sleep, faster)
- **Vercel Pro**: $20/month (team features)
- **Custom domain**: $10-15/year

---

## 📱 **Sharing with Family**

Once deployed:
1. **Share the GitHub Pages URL**
2. **Works on all devices** (mobile responsive!)
3. **No installation needed** - just open in browser
4. **Always up-to-date** - redeploy with `npm run deploy`

Perfect for showing off your rocket designer to family and friends! 🚀✨
