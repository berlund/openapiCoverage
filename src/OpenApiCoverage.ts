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

  static use(axiosInstance: AxiosInstance, options?: Options){
    return new OpenApiCoverage(axiosInstance, options);
  }

  withSpecificationFromFile(specPath: string){
    this.coverageModel.registerSpecFromYaml(specPath);
    return this;
  }

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
