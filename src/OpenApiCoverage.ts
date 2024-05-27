import { AxiosError, AxiosInstance } from 'axios';
import CoverageModel, { Options, ReportOptions } from './CoverageModel';

export class OpenApiCoverage {
  private axiosInstance: AxiosInstance;
  private coverageModel: CoverageModel;

  private constructor(axiosInstance: AxiosInstance, options?: Options) {
    this.axiosInstance = axiosInstance;
    this.coverageModel = new CoverageModel(options);
    this.registerInterceptor();
  }

  /**
   * Use the given Axios instance to measure coverage.
   *
   * @static
   * @param {AxiosInstance} axiosInstance an Axios instance
   * @param {Options} [options] options for controlling coverage report output
   * @return {*} an instance of OpenApiCoverage
   * @memberof OpenApiCoverage
   */
  static use(axiosInstance: AxiosInstance, options?: Options){
    return new OpenApiCoverage(axiosInstance, options);
  }

  /**
   * Use a given specification for measuring coverage
   * @param specPath the file path to an Open API specification document in YAML.
   * @returns 
   */
  withSpecificationFromFile(specPath: string){
    this.coverageModel.registerSpecFromYaml(specPath);
    return this;
  }

  /**
   * Prints a coverage report to the console
   * @param options The report options
   */
  printCoverage(options?: ReportOptions){
    this.coverageModel.printCoverage(options);
  }

  private registerInterceptor(): void {
    this.axiosInstance.interceptors.response.use((response) => {
      this.coverageModel.handleResponse(response);
      return response;
    },
      (error) => {
        this.coverageModel.handleFailedResponse(error as AxiosError);
        return error;
      });
  }
}
