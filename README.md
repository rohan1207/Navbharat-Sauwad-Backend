# Newspaper Backend API

Backend server for managing e-papers.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## API Endpoints

### GET /api/epapers
Get all e-papers

### GET /api/epapers/:id
Get a specific e-paper by ID

### POST /api/epapers
Create a new e-paper
```json
{
  "title": "E-paper Title",
  "date": "2024-01-15",
  "pages": [...]
}
```

### PUT /api/epapers/:id
Update an existing e-paper

### DELETE /api/epapers/:id
Delete an e-paper

### GET /api/health
Health check endpoint

## Data Storage

E-papers are stored in `data/epapers.json` file. The data directory is created automatically.




