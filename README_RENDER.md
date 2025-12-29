# Deploying to Render

## Build Configuration

The backend uses `canvas` package which requires system dependencies. On Render, you need to configure the build to install these dependencies.

### Option 1: Using Render Dashboard

1. Go to your Render service settings
2. Under "Build Command", set:
   ```bash
   apt-get update && apt-get install -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev && npm install
   ```
3. Under "Start Command", set:
   ```bash
   npm start
   ```

### Option 2: Using render.yaml (if using Render Blueprint)

The `render.yaml` file is already configured. Make sure your Render service is set up to use it.

### Environment Variables

Make sure to set these in Render dashboard:
- `MONGODB_URI` - Your MongoDB connection string
- `CLOUDINARY_CLOUD_NAME` - Your Cloudinary cloud name
- `CLOUDINARY_API_KEY` - Your Cloudinary API key
- `CLOUDINARY_API_SECRET` - Your Cloudinary API secret
- `NODE_ENV` - Set to `production`
- `PORT` - Render will set this automatically

### Troubleshooting

If you get "linux is NOT supported" error:
1. Make sure the build command installs canvas dependencies
2. Check that `canvas` package is in package.json
3. Verify the build logs show canvas being compiled successfully

If PDF conversion fails:
1. Check that all canvas dependencies are installed
2. Verify the PDF file is valid
3. Check server logs for detailed error messages


