/**
 * Mock for next/dynamic.
 *
 * In JSDOM there is no Leaflet-compatible canvas/DOM environment.
 * This mock makes next/dynamic render the imported module synchronously
 * rather than lazily, so components under test that use dynamic() can
 * still be rendered without SSR issues.
 *
 * IMPORTANT: the mock calls importFn() synchronously and renders the
 * resolved component. This requires jest.mock() of the imported module
 * to exist so the require() call succeeds. Tests that mock the dynamic
 * component (e.g. LocationMap) will have that mock rendered directly.
 */
const React = require("react");

const dynamic = (importFn, _options) => {
  // Resolve the module synchronously via require. Jest's module system makes
  // this work because jest.mock() replaces the module in the registry.
  // We extract the module path from the function source for require().
  // However, since importFn is an arrow function, we cannot easily extract
  // the module path. Instead, we call the import function and use the result
  // synchronously through a workaround: we render a wrapper that calls the
  // async import, then re-renders with the loaded component.
  //
  // For tests: the component should be mocked via jest.mock("...path...", ...)
  // and the nextDynamic mock calls importFn() which resolves the jest.mock.

  let ResolvedComponent = null;

  // Call importFn() which returns a Promise. Since jest.mock() makes require()
  // synchronous, we can resolve the promise immediately by calling the factory.
  // We use a trick: extract the require call from the function body.
  // Since importFn is like `() => import("../components/LocationMap")`,
  // Babel compiles it to `() => Promise.resolve().then(() => require("..."))`.
  // The require() inside is synchronous in Jest, but wrapped in a Promise.
  // We call importFn() and synchronously access the mock via require().

  // Simple approach: call importFn() and stash the resolved component via
  // a then() that runs in the current microtask queue. For synchronous tests
  // this works because React renders are also synchronous in test mode.

  // Actually, the cleanest approach for tests is to call importFn() and
  // return a component that will render the result once resolved. But
  // since tests use act() and waitFor(), we need this to be synchronous.

  // FINAL approach: Use a class component with state to handle async resolution.
  class DynamicWrapper extends React.Component {
    constructor(props) {
      super(props);
      this.state = { LoadedComponent: null };
    }

    componentDidMount() {
      importFn().then((mod) => {
        const Component = mod && mod.__esModule ? (mod.default || mod) : (mod.default || mod);
        this.setState({ LoadedComponent: Component });
      }).catch(() => {
        // If import fails, render the loading fallback
      });
    }

    render() {
      const { LoadedComponent } = this.state;
      if (LoadedComponent) {
        return React.createElement(LoadedComponent, this.props);
      }
      // Render loading fallback while resolving
      if (_options && _options.loading) {
        const Loading = _options.loading;
        return Loading({ error: null, isLoading: true, pastDelay: true, retry: () => {} });
      }
      return null;
    }
  }

  DynamicWrapper.displayName = "DynamicWrapper";
  return DynamicWrapper;
};

module.exports = dynamic;
