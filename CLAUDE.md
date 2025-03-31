# SOMAP Project Guidelines

## Build and Run Commands
```bash
# Install dependencies
bun install

# Run development server
bun run index.ts

# Run t1 server (secondary server)
bun run t1.ts

# Serve with hot reload (if available)
bun run reload.js
```

## Code Style Guidelines

### TypeScript
- Use TypeScript for new files with proper type annotations
- Follow `strict: true` mode settings in tsconfig.json
- Use `ESNext` features as configured in tsconfig.json

### Formatting
- Use double quotes for strings
- 2 space indentation
- Use semicolons at the end of statements
- Use camelCase for variables, functions, and methods
- Use PascalCase for classes and types

### Error Handling
- Use try/catch blocks for async operations
- Log errors with details using console.error
- Return appropriate HTTP status codes with clear error messages

### Imports
- Use ES module syntax (`import from`)
- Group imports by external packages first, then internal modules

### API Structure
- Follow RESTful conventions for endpoints
- Use appropriate HTTP methods (GET, POST, PATCH, DELETE)
- Include proper error handling and validation