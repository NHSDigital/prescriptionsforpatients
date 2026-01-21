import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Resolves $ref in example values (non-standard OpenAPI usage that swagger-cli supported)
 * Recursively walks the spec and replaces value: { $ref: "path" } with the actual content
 */
function resolveExampleRefs(obj, basePath) {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => resolveExampleRefs(item, basePath));
  }

  // Check if this is a value: { $ref: "path" } pattern
  if (obj.value && typeof obj.value === 'object' && obj.value.$ref && typeof obj.value.$ref === 'string') {
    const refPath = obj.value.$ref;

    // Only process file references (not # references)
    if (!refPath.startsWith('#')) {
      const fullPath = path.resolve(basePath, refPath);

      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        const parsed = JSON.parse(content);

        console.log(`Resolved: ${refPath}`);

        // Replace the $ref with the actual content
        return {
          ...obj,
          value: parsed
        };
      } catch (error) {
        console.error(`Error resolving ${refPath}:`, error.message);
      }
    }
  }

  // Recursively process all properties
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = resolveExampleRefs(value, basePath);
  }
  return result;
}

// Main execution
const specPath = path.join(__dirname, 'prescriptions-for-patients.yaml');
const specContent = fs.readFileSync(specPath, 'utf8');
const spec = yaml.parse(specContent);

console.log('Resolving example $refs...');
const resolved = resolveExampleRefs(spec, __dirname);

// Create dist directory if it doesn't exist
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });

// Write preprocessed file to root directory (same location as original)
// so relative paths to schemas/ still work
const preprocessedPath = path.join(__dirname, 'prescriptions-for-patients.preprocessed.yaml');
fs.writeFileSync(preprocessedPath, yaml.stringify(resolved));

console.log(`\nPreprocessed spec written to: ${preprocessedPath}`);
