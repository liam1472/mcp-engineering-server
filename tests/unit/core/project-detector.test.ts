/**
 * Unit tests for core/project-detector.ts
 */

/// <reference types="vitest/globals" />
import { ProjectDetector } from '../../../src/core/project-detector.js';
import {
  createMockProject,
  cleanupTempDir,
  copyFixtureToTemp,
} from '../../setup.js';

describe('core/project-detector.ts', () => {
  describe('ProjectDetector', () => {
    let tempDir: string;

    afterEach(async () => {
      if (tempDir) {
        await cleanupTempDir(tempDir);
      }
    });

    describe('detect()', () => {
      it('should detect nodejs-typescript project', async () => {
        tempDir = await createMockProject({
          'package.json': JSON.stringify({
            name: 'test-project',
            devDependencies: { typescript: '^5.0.0' },
          }),
          'tsconfig.json': '{}',
        });

        const detector = new ProjectDetector(tempDir);
        const type = await detector.detect();

        expect(type).toBe('web-node');
      });

      it('should detect web-react project', async () => {
        tempDir = await createMockProject({
          'package.json': JSON.stringify({
            name: 'react-app',
            dependencies: { react: '^18.0.0' },
          }),
        });

        const detector = new ProjectDetector(tempDir);
        const type = await detector.detect();

        expect(type).toBe('web-react');
      });

      it('should detect native-rust project', async () => {
        tempDir = await createMockProject({
          'Cargo.toml': `
[package]
name = "test-rust"
version = "0.1.0"
          `,
        });

        const detector = new ProjectDetector(tempDir);
        const type = await detector.detect();

        expect(type).toBe('native-rust');
      });

      it('should detect native-go project', async () => {
        tempDir = await createMockProject({
          'go.mod': `
module test-go

go 1.21
          `,
        });

        const detector = new ProjectDetector(tempDir);
        const type = await detector.detect();

        expect(type).toBe('native-go');
      });

      it('should detect python-general project', async () => {
        // Only pyproject.toml without app.py = python-general
        tempDir = await createMockProject({
          'pyproject.toml': '[project]\nname = "test"',
        });

        const detector = new ProjectDetector(tempDir);
        const type = await detector.detect();

        expect(type).toBe('python-general');
      });

      it('should detect python-flask project', async () => {
        // requirements.txt + app.py = python-flask (priority 70 > python-general 50)
        tempDir = await createMockProject({
          'requirements.txt': 'flask>=2.0.0',
          'app.py': 'from flask import Flask',
        });

        const detector = new ProjectDetector(tempDir);
        const type = await detector.detect();

        expect(type).toBe('python-flask');
      });

      it('should detect dotnet project with csproj', async () => {
        // Note: dotnet-wpf (priority 85) matches before dotnet-aspnet (80)
        // because both match on *.csproj and detection uses OR logic
        tempDir = await createMockProject({
          'Test.csproj': '<Project Sdk="Microsoft.NET.Sdk"></Project>',
          'Program.cs': 'class Program { }',
          'appsettings.json': '{}',
        });

        const detector = new ProjectDetector(tempDir);
        const type = await detector.detect();

        // Detection returns highest priority match that has *.csproj
        expect(type).toMatch(/^dotnet-/);
      });

      it('should detect dotnet-wpf with App.xaml', async () => {
        tempDir = await createMockProject({
          'Test.csproj': '<Project Sdk="Microsoft.NET.Sdk"></Project>',
          'App.xaml': '<Application></Application>',
        });

        const detector = new ProjectDetector(tempDir);
        const type = await detector.detect();

        expect(type).toBe('dotnet-wpf');
      });

      it('should detect embedded-arduino project', async () => {
        tempDir = await createMockProject({
          'Blink.ino': 'void setup() {} void loop() {}',
        });

        const detector = new ProjectDetector(tempDir);
        const type = await detector.detect();

        expect(type).toBe('embedded-arduino');
      });

      it('should detect embedded-stm32 project', async () => {
        tempDir = await createMockProject({
          'STM32F4.ioc': '#MicroXplorer Configuration',
        });

        const detector = new ProjectDetector(tempDir);
        const type = await detector.detect();

        expect(type).toBe('embedded-stm32');
      });

      it('should detect web-nextjs project', async () => {
        tempDir = await createMockProject({
          'next.config.js': 'module.exports = {}',
          'package.json': '{"name": "nextjs-app"}',
        });

        const detector = new ProjectDetector(tempDir);
        const type = await detector.detect();

        expect(type).toBe('web-nextjs');
      });

      it('should detect web-angular project', async () => {
        tempDir = await createMockProject({
          'angular.json': '{}',
          'package.json': '{"name": "angular-app"}',
        });

        const detector = new ProjectDetector(tempDir);
        const type = await detector.detect();

        expect(type).toBe('web-angular');
      });

      it('should return unknown for empty project', async () => {
        tempDir = await createMockProject({
          'README.md': '# Empty Project',
        });

        const detector = new ProjectDetector(tempDir);
        const type = await detector.detect();

        expect(type).toBe('unknown');
      });

      it('should prioritize higher priority matches', async () => {
        // embedded-stm32 has priority 100, web-node has priority 50
        tempDir = await createMockProject({
          'STM32F4.ioc': '#MicroXplorer Configuration',
          'package.json': '{"name": "hybrid-project"}',
        });

        const detector = new ProjectDetector(tempDir);
        const type = await detector.detect();

        expect(type).toBe('embedded-stm32');
      });
    });

    describe('setWorkingDir()', () => {
      it('should change working directory', async () => {
        tempDir = await createMockProject({
          'Cargo.toml': '[package]\nname = "rust-proj"',
        });

        const detector = new ProjectDetector('/some/other/path');
        detector.setWorkingDir(tempDir);
        const type = await detector.detect();

        expect(type).toBe('native-rust');
      });
    });

    describe('with fixtures', () => {
      it('should detect nodejs-typescript fixture', async () => {
        tempDir = await copyFixtureToTemp('nodejs-typescript');

        const detector = new ProjectDetector(tempDir);
        const type = await detector.detect();

        expect(type).toBe('web-node');
      });

      it('should detect rust fixture', async () => {
        tempDir = await copyFixtureToTemp('rust');

        const detector = new ProjectDetector(tempDir);
        const type = await detector.detect();

        expect(type).toBe('native-rust');
      });

      it('should detect go fixture', async () => {
        tempDir = await copyFixtureToTemp('go');

        const detector = new ProjectDetector(tempDir);
        const type = await detector.detect();

        expect(type).toBe('native-go');
      });

      it('should detect python fixture as flask', async () => {
        // Python fixture has app.py which triggers python-flask detection
        tempDir = await copyFixtureToTemp('python');

        const detector = new ProjectDetector(tempDir);
        const type = await detector.detect();

        // Fixture has app.py + requirements.txt = python-flask
        expect(type).toBe('python-flask');
      });

      it('should detect embedded-arduino fixture', async () => {
        tempDir = await copyFixtureToTemp('arduino');

        const detector = new ProjectDetector(tempDir);
        const type = await detector.detect();

        expect(type).toBe('embedded-arduino');
      });
    });
  });
});
