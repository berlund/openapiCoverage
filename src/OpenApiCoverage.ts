import { AxiosError, AxiosInstance } from 'axios';
import CoverageModel, { ApiOptions, Options, ReportOptions } from './CoverageModel';

export class OpenApiCoverage {
  private coverageModel: CoverageModel;

  private constructor(axiosInstance: AxiosInstance, options?: Options) {
    this.coverageModel = new CoverageModel(options);
    this.registerInterceptor(axiosInstance);
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
   * Use the given Axios instance to measure coverage.
   *
   * @param {AxiosInstance} axiosInstance an Axios instance
   * @return {*} an instance of OpenApiCoverage
   * @memberof OpenApiCoverage
   */
    use(axiosInstance: AxiosInstance){
      this.registerInterceptor(axiosInstance);
      return this;
    }

  /**
   * Use a given specification for measuring coverage
   * @param specPath the file path to an Open API specification document in YAML.
   * @returns 
   */
  withSpecificationFromFile(specPath: string, options?: ApiOptions){
    this.coverageModel.registerSpecFromYaml(specPath, options);
    return this;
  }

  /**
   * Prints a coverage report to the console
   * @param options The report options
   */
  printCoverage(options?: ReportOptions){
    this.coverageModel.printCoverage(options);
  }

  private registerInterceptor(axiosInstance: AxiosInstance): void {
    axiosInstance.interceptors.response.use((response) => {
      this.coverageModel.handleResponse(response);
      return response;
    },
      (error) => {
        this.coverageModel.handleFailedResponse(error as AxiosError);
        return error;
      });
  }
}
