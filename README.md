# CSV and Excel File Processing System

A robust Node.js-based system for processing CSV and Excel files using Bull Queue with Redis for job management. This system provides parallel processing capabilities for different file types with real-time progress tracking.

## Features

- Supports both CSV and Excel (.xlsx, .xls) file formats
- Parallel processing using separate workers
- Real-time job progress tracking
- Bull Queue integration with Redis
- Docker containerization
- Detailed logging system
- File validation
- Batch processing
- RESTful API endpoints
- Health monitoring

## System Architecture

```
csv-processor/
├── src/
│   ├── api/
│   │   └── app.js           # Main API server
│   ├── worker/
│   │   ├── worker.js        # CSV processing worker
│   │   └── worker_2.js      # Excel processing worker
│   └── monitor/
│       └── monitor.js       # System monitoring
├── docker/
│   ├── api.Dockerfile
│   ├── worker.Dockerfile
│   └── monitor.Dockerfile
├── uploads/                 # Temporary file storage
├── logs/                    # Application logs
├── docker-compose.yml
├── package.json
└── .env
```

## Prerequisites

- Node.js (v14+)
- Docker and Docker Compose
- Redis

## Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd csv-processor
```

2. Install dependencies:

```bash
npm install
```

3. Create required directories:

```bash
mkdir uploads logs
```

4. Create .env file:

```env
REDIS_URL=redis://redis:6379
NODE_ENV=production
PORT=3000
MONITOR_PORT=3001
```

## Running with Docker

1. Build and start the containers:

```bash
docker-compose up --build
```

2. Stop the containers:

```bash
docker-compose down
```

## API Endpoints

### File Upload

```bash
POST /upload
Content-Type: multipart/form-data
Body: file=@path/to/file.(csv|xlsx|xls)
```

### Job Status

```bash
# Get specific job status
GET /job/:jobId?worker=csv|excel

# Get multiple jobs with pagination
GET /jobs?worker=csv|excel&status=active|completed|failed&page=1&pageSize=10
```

### Health Check

```bash
GET /health
```

## Example Usage

### Upload CSV File

```bash
curl -X POST -F "file=@products.csv" http://localhost:3000/upload
```

### Upload Excel File

```bash
curl -X POST -F "file=@products.xlsx" http://localhost:3000/upload
```

### Check Job Status

```bash
# For CSV jobs
curl http://localhost:3000/job/123?worker=csv

# For Excel jobs
curl http://localhost:3000/job/123?worker=excel
```

### Get Multiple Jobs

```bash
# Get active CSV jobs
curl http://localhost:3000/jobs?worker=csv&status=active&page=1&pageSize=10

# Get completed Excel jobs
curl http://localhost:3000/jobs?worker=excel&status=completed
```

## File Format Requirements

### CSV Format

```csv
ProductID,ProductName,Price,Quantity
P001,Product1,10.99,100
P002,Product2,20.99,200
```

### Excel Format

Same column headers as CSV format:

- ProductID
- ProductName
- Price
- Quantity

## Monitoring and Logs

- Application logs: `./logs/combined.log`
- Error logs: `./logs/error.log`
- Worker-specific logs: `./logs/worker-*.log`

## Configuration

### Docker Compose Configuration

```yaml
services:
  redis:
    image: redis:alpine
    ports:
      - "6379:6379"

  api:
    build:
      context: .
      dockerfile: docker/api.Dockerfile
    ports:
      - "3000:3000"

  csv-worker:
    build:
      context: .
      dockerfile: docker/worker.Dockerfile

  excel-worker:
    build:
      context: .
      dockerfile: docker/worker_2.Dockerfile
```

### Worker Configuration

- Batch Size: 100 records per batch
- File Size Limit: 5MB
- Supported File Types: .csv, .xlsx, .xls

## Performance Considerations

- Uses batch processing for optimal performance
- Separate queues for CSV and Excel processing
- Concurrent processing of different file types
- Automatic retry mechanism for failed jobs
- Resource limits per container

## Error Handling

The system includes comprehensive error handling for:

- Invalid file formats
- Missing required columns
- Processing failures
- Queue connection issues
- File system errors

## Development

### Running in Development Mode

```bash
# Start Redis locally
docker run -p 6379:6379 redis:alpine

# Start API server
npm run start:api

# Start CSV worker
npm run start:worker

# Start Excel worker
npm run start:worker2
```

### Testing

```bash
# Generate test data for CSV and Excel
npm run generate:excel
npm run generate:csv

# Upload test file
curl -X POST -F "file=@products_1000.csv" http://localhost:3000/upload
```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

[MIT License](LICENSE)

## Acknowledgments

- Bull Queue
- Node.js
- Redis
- ExcelJS
- csv-parse
