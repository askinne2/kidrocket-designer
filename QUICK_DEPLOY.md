# 🚀 Quick Deploy for Family Sharing

## 🎯 **5-Minute Setup**

### **Step 1: Push to GitHub** (if not done yet)
```bash
git remote add origin https://github.com/YOUR_USERNAME/kidrocket-designer.git
git push -u origin main
```

### **Step 2: Deploy Frontend to GitHub Pages**
1. **Edit** `client/package.json` line 25:
   ```json
   "homepage": "https://YOUR_GITHUB_USERNAME.github.io/kidrocket-designer"
   ```

2. **Deploy**:
   ```bash
   cd client
   npm run deploy
   ```

3. **Enable GitHub Pages**:
   - Go to your repo → Settings → Pages
   - Source: `gh-pages` branch
   - Save

**✅ Frontend live at**: `https://YOUR_USERNAME.github.io/kidrocket-designer`

### **Step 3: Deploy Backend (Optional)**
- **Quick option**: Frontend works with mock data for family demos
- **Full option**: Deploy to Render.com (see DEPLOYMENT.md)

---

## 🎉 **Share with Family**

**Send them the link**: `https://YOUR_USERNAME.github.io/kidrocket-designer`

**Works on**:
- 📱 Phones (iOS/Android)
- 💻 Computers (Mac/PC)
- 📟 Tablets
- 🌐 Any modern web browser

**Features they'll see**:
- Design rockets with realistic physics
- Real-time performance estimates
- Launch simulations with weather
- Interactive results with charts
- Mobile-friendly interface

---

## 💡 **Pro Tips**

1. **Test first**: Try the deployment locally
2. **Share early**: Get family feedback on the UI
3. **Update easily**: Just run `npm run deploy` to update
4. **Mobile-first**: It works great on phones!

**Total time**: 5-10 minutes to go live! 🚀✨
