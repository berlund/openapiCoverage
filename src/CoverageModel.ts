import { AxiosError, AxiosResponse } from 'axios';
import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';
import { table } from 'table';


/**
 * OpenApi Coverage options for controlling the output of the coverage report to a file.
 * @typedef {Object} Options
 * @property {string} outputFormat - The output format for coverage reports written to a file. No file will be generated if set to 'none' (default)
 * @property {string} outputPath - The path where to write coverage report files to. Will default to the current working directory§
 * @property {debug} debug - Enable debug logging (false)
 */
export type Options = {
  outputFormat: 'html' | 'none';
  outputPath?: string;
  debug?: boolean;
}

/**
 * OpenApi Coverage report options for printing coverage report to the console
 * @typedef {Object} ReportOptions
 * @property {string} showZeroCounts - Include paths that where not covered, i.e. have a count of zero
 */
export type ReportOptions = {
  showZeroCounts: boolean;
}

/**
 * OpenApi Coverage options for the specification to use
 * @typedef {Object} ReportOptions
 * @property {string} pathPrefix - Include a path prefix when matching API calls agains the specification. Useful when the beginning of path is contained in the server, not in the path's element.
 */
export type ApiOptions = {
  pathPrefix?: string
}

interface OpenApiPath {
  [method: string]: {
    responses: { [status: string]: number }
  };
}

interface OpenApiSpec {
  paths: {
    [path: string]: OpenApiPath;
  };
}

interface CoverageRecord {
  path: string;
  method: string;
  status: string;
  count: number;
}

class CoverageModel {
  private specs: OpenApiSpec[] = [];
  private coverage: { [path: string]: OpenApiPath } = {};
  private pathRegexList: { regex: RegExp, path: string }[] = [];
  private outputPath: string;
  private outputFormat: 'none' | 'html';
  private debugEnabled: boolean;

  /**
   * Creates an instance of OpenApiCoverage.
   * @param {Options} [options] optional options for configuration
   * @memberof OpenApiCoverage
   */
  constructor(options?: Options) {
    this.outputPath = options?.outputPath || process.cwd();
    this.outputFormat = options?.outputFormat || 'none';
    this.debugEnabled = options?.debug || false;
  }

  /**
   * Registers a single OpenAPI specification in YAML format from the local file system.
   *
   * @param {string} specPath the path to the yaml file
   * @memberof OpenApiCoverage
   */
  public registerSpecFromYaml(specPath: string, options?: ApiOptions): void {
    const yamlDoc = fs.readFileSync(specPath, 'utf-8');
    const spec = yaml.load(yamlDoc);
    this.specs.push(spec as OpenApiSpec);
    this.initializeCoverage(spec as OpenApiSpec, options);
  }


  private initializeCoverage(spec: OpenApiSpec, options?: ApiOptions): void {

    const { pathPrefix = '' } = options ?? {};
    for (const [path, pathEntry] of Object.entries(spec.paths)) {

      if (path === '/{proxy+}') {
        continue;
      }
      const regex = this.pathToRegex(pathPrefix + path);
      this.pathRegexList.push({ regex, path });
      if (!this.coverage[path]) {
        this.coverage[path] = {};
      }
      for (const [method, methodEntry] of Object.entries(pathEntry)) {
        if (!this.coverage[path][method]) {
          this.coverage[path][method] = { responses: {} };
        }
        for (const [status, _] of Object.entries(methodEntry.responses)) {
          if (!this.coverage[path][method].responses[status]) {
            this.coverage[path][method].responses[status] = 0;
          }
        }
      }
    }
  }

  private pathToRegex(path: string): RegExp {
    const innerRegex = path.replace(/{[^}]+}/g, '[\\S]+').replace('/\//g', '\/');
    return new RegExp(`^${innerRegex}$`)
  }

  private matchPath(urlPath: string): string | null {
    for (const { regex, path } of this.pathRegexList) {
      this.debug(`matching ${urlPath} against ${regex}`)
      if (regex.test(urlPath)) {
        this.debug('matched')
        return path;
      }
    }
    return null;
  }

  private debug(msg: string, data?: object | number | string) {
    if (!this.debugEnabled) return;

    let dataString;
    if (data instanceof Object) {
      dataString = JSON.stringify(data)
    } else {
      dataString = data;
    }
    console.debug(`[debug] ${msg}${dataString ? `, ${dataString}` : ''}`)
  }

  public async handleResponse(response: AxiosResponse): Promise<void> {
    const { method, url, baseURL } = response.config;
    const status = response.status.toString();
    this.debug('handle response', { method, url, baseURL })

    const normalizedPath = this.normalizePath(url, baseURL);
    const normalizedMethod = method!.toLowerCase();
    const matchedPath = this.matchPath(normalizedPath);

    this.debug('response matching', { normalizedPath, matchedPath, normalizedMethod, status })

    if (matchedPath && this.coverage[matchedPath] && this.coverage[matchedPath][normalizedMethod]) {
      if (this.coverage[matchedPath][normalizedMethod].responses[status] !== undefined) {
        this.debug('matched coverage')
        this.coverage[matchedPath][normalizedMethod].responses[status]++;
      }
    }
    this.writeCoverageToFile();
  }

  public async handleFailedResponse(error: AxiosError): Promise<void> {
    if (error.response) {
      return this.handleResponse(error.response)
    } else {
      console.warn('not a axios response');
    }

  }

  private normalizePath(path?: string, baseURL?: string): string {
    const effectiveURL = baseURL ? `${baseURL}${path}` : path;
    if (!effectiveURL) {
      throw new Error('Response without url')
    }

    const url = new URL(effectiveURL);
    return url.pathname;
  }

  private writeCoverageToFile(): void {
    let output, suffix;
    if (this.outputFormat === 'html') {
      output = this.generateHtmlCoverage();
      suffix = 'html'

      fs.writeFileSync(path.join(this.outputPath, 'coverage.json'), JSON.stringify(this.coverage, null, 2));
      fs.writeFileSync(path.join(this.outputPath, `coverage_output.${suffix}`), output);
    }
  }

  private generateCoverageRecords(): CoverageRecord[] {
    const records: CoverageRecord[] = [];
    for (const [path, methods] of Object.entries(this.coverage)) {
      for (const [method, statuses] of Object.entries(methods)) {
        for (const [status, count] of Object.entries(statuses.responses)) {
          records.push({ path, method, status, count });
        }
      }
    }
    return records.sort((a, b) => {
      if (a.path !== b.path) return a.path.localeCompare(b.path);
      if (a.method !== b.method) return a.method.localeCompare(b.method);
      return a.status.localeCompare(b.status);
    });
  }

  private generateCoverageTable({ showZeroCounts }: ReportOptions): string {

    const data = [['Path', 'Method', 'Status', 'Count']];

    this.generateCoverageRecords().forEach((record) => {
      if (showZeroCounts || record.count > 0) {
        const countStr = record.count === 0 ? `\x1b[31m${record.count}\x1b[0m` : record.count.toString();
        data.push([record.path, record.method, record.status, countStr]);
      }
    });

    return table(data);
  }

  private generateHtmlCoverage(): string {
    let html = `
    <html>
    <body>
    <table>
      <tr>
        <th>Path</th>
        <th>Method</th>
        <th>Status</th>
        <th>Count</th>
      </tr>`;

    this.generateCoverageRecords().forEach((record) => {
      const countStr = record.count === 0 ? `<span style="color: red;">${record.count}</span>` : record.count.toString();
      html += `<tr><td>${record.path}</td><td>${record.method}</td><td>${record.status}</td><td>${countStr}</td></tr>`;
    });

    html += '</table></body></html>';
    return html;
  }

  /**
   * Prints a coverage report to the console.
   *
   * @param {ReportOptions} [reportOptions]
   * @memberof OpenApiCoverage
   */
  public printCoverage(reportOptions?: ReportOptions): void {
    const options = reportOptions || { showZeroCounts: false };
    const output = this.generateCoverageTable(options);
    console.log(output);
  }
}

export default CoverageModel;
