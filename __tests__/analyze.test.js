import { jest } from '@jest/globals';
import { analyze } from '../src/index.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('dependency-analyzer', () => {
  const fixturesPath = path.join(__dirname, '__fixtures__');
  
  beforeEach(() => {
    // Clear mocks between tests
    jest.clearAllMocks();
  });

  test('analyzes dependencies correctly in a simple project', async () => {
    const testProjectPath = path.join(fixturesPath, 'simple-project');
    const result = await analyze(testProjectPath, false);
    
    expect(result).toBeDefined();
    expect(result.used).toBeInstanceOf(Array);
    expect(result.unused).toBeInstanceOf(Array);
    expect(result.packageDetails).toBeInstanceOf(Map);
  });

  test('includes devDependencies when dev flag is true', async () => {
    const testProjectPath = path.join(fixturesPath, 'simple-project');
    const result = await analyze(testProjectPath, true);
    
    expect(result).toBeDefined();
    expect(result.includesDevDependencies).toBe(true);
  });

  test('handles project with no dependencies', async () => {
    const testProjectPath = path.join(fixturesPath, 'empty-project');
    const result = await analyze(testProjectPath, false);
    
    expect(result.used).toHaveLength(0);
    expect(result.unused).toHaveLength(0);
  });

  test('handles invalid project path', async () => {
    const invalidPath = path.join(fixturesPath, 'non-existent-project');
    
    await expect(analyze(invalidPath, false)).rejects.toThrow();
  });
});
