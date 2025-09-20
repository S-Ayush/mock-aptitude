# Netlify Deployment Guide

## 🚀 Deploying to Netlify

### 1. Environment Variables Setup

Before deploying, make sure to set up your environment variables in Netlify:

1. Go to your Netlify dashboard
2. Navigate to Site settings > Environment variables
3. Add the following variables:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

### 2. Build Settings

The project is configured with the following build settings:

- **Build command**: `npm run build`
- **Publish directory**: `dist`
- **Node version**: 18

### 3. Files Created for Netlify

- `netlify.toml` - Netlify configuration file
- `public/_redirects` - Fallback routing for SPA
- Updated `vite.config.ts` with proper base path

### 4. Deployment Steps

1. **Connect your repository** to Netlify
2. **Set environment variables** as mentioned above
3. **Deploy** - Netlify will automatically build and deploy

### 5. Troubleshooting

If you encounter MIME type errors:

1. Check that `netlify.toml` is in the root directory
2. Verify environment variables are set correctly
3. Clear Netlify cache and redeploy
4. Check browser console for specific error messages

### 6. Post-Deployment

After successful deployment:

1. Test the application functionality
2. Verify Supabase connection
3. Test student login and test taking
4. Check admin panel functionality

## 🔧 Configuration Files

### netlify.toml
```toml
[build]
  publish = "dist"
  command = "npm run build"

[build.environment]
  NODE_VERSION = "18"

[[headers]]
  for = "/*.js"
  [headers.values]
    Content-Type = "application/javascript; charset=utf-8"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### vite.config.ts
```typescript
export default defineConfig({
  plugins: [react()],
  base: './',  // Important for Netlify
  // ... rest of config
});
```

## ✅ Success Indicators

- ✅ Application loads without MIME type errors
- ✅ All routes work correctly
- ✅ Supabase connection established
- ✅ Student and admin functionality working
- ✅ Questions load and display properly
