# OpenApiCoverage for NodeJS

Measures code coverage in terms of calls being made to an API specified by an OpenAPI specification.

## Installation

```
  npm install -D @berlund/openapicoverage
```

## Usage

Just import the Code coverage class and hand over your Axios instance to it. Then point it to your OpenApi specification and you're good to go:

```js
const axios = require('axios');
const { OpenApiCoverage } = require('@berlund/openapicoverage');

const axiosInstance = axios.create();
const coverage = OpenApiCoverage.use(axiosInstance).withSpecificationFromFile('./openapi.yaml');
```

Run your tests as usual, e.g.

```js
  it('should run', async() => {
      await axiosInstance.get('https://example.com/some/path');
      await axiosInstance.get('https://example.com/some/path');
      await axiosInstance.post('https://example.com/path/to/post', {data: 'foo'});
  })
```
### Multiple Axios instances

Multiple Axios instances can be chained:

```js
OpenApiCoverage.use(firstAxiosInstance).use(anotherAxiosInstance)
```

### Options for API definition

In case the path of your API calls isn't entirely defined in the API's paths but in the base path of your specification, a path prefix is accepted:

```js
.withSpecification(path, { pathPrefix: '/v1' })
```

### Report generation

#### Console
After your tests have been run, you can print a coverage report on the console. 

```js
 afterAll(() => {
    coverage.printCoverage();
  })
```
This will result in something like the following. 

```
    ╔══════════════════════════════════╤════════╤════════╤═══════╗
    ║ Path                             │ Method │ Status │ Count ║
    ╟──────────────────────────────────┼────────┼────────┼───────╢
    ║ https://example.com/some/path    │ get    │ 200    │ 2     ║
    ╟──────────────────────────────────┼────────┼────────┼───────╢
    ║ https://example.com/path/to/post │ post   │ 202    │ 1     ║
    ╚══════════════════════════════════╧════════╧════════╧═══════╝

```

The following options will output all combinations of path, method and response status, even if they haven't been called:

```js
coverage.printCoverage({ showZeroCounts: true })
```

#### File report
Another option is to configure a file output which is updated on every Api call:

```js
OpenApiCoverage.use(axiosInstance, options)
```

where options can have the following properties:

| Property| type| Description |
|------------|-------|-------------------------|
| outputFormat | `none` \| `html` | `none` disables file output (default) or simple HTML formatted output |
| outputPath | `string` | A file path where output should be written to. Ignored if output format is set to none. Will default to the current working directory

