# Backend Setup Guide - Production

## Prerequisites

### 1. Install System Dependencies

**For PDF conversion (pdf-poppler requires poppler-utils):**

**Windows:**
- Download poppler from: https://github.com/oschwartz10612/poppler-windows/releases
- Extract and add to PATH
- Or use: `choco install poppler` (if you have Chocolatey)

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get update
sudo apt-get install poppler-utils
```

**macOS:**
```bash
brew install poppler
```

### 2. Install Node Dependencies

```bash
cd backend
npm install
```

### 3. Environment Variables

Create `.env` file in backend directory (already created with your credentials).

### 4. Start Server

```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## API Endpoints

### E-Papers

- `GET /api/epapers` - Get all published epapers (for frontend)
- `GET /api/epapers/all` - Get all epapers including drafts (for admin)
- `GET /api/epapers/:id` - Get specific epaper
- `POST /api/epapers/upload` - Upload PDF and create e-paper
- `POST /api/epapers` - Create e-paper (alternative)
- `PUT /api/epapers/:id` - Update e-paper (including mappings)
- `DELETE /api/epapers/:id` - Delete e-paper

### Health Check

- `GET /api/health` - Check server status

## Database

- **MongoDB Atlas**: Connected automatically
- **Collection**: `epapers`
- **Storage**: Cloudinary for images

## Troubleshooting

### PDF Conversion Issues

If PDF conversion fails:
1. Check if poppler-utils is installed: `pdftoppm -h`
2. On Windows, ensure poppler is in PATH
3. Check temp directory permissions

### Cloudinary Issues

1. Verify credentials in `.env`
2. Check Cloudinary dashboard for upload limits
3. Verify network connectivity

### MongoDB Issues

1. Check connection string in `.env`
2. Verify MongoDB Atlas IP whitelist (should allow all IPs for testing)
3. Check database name in connection string




