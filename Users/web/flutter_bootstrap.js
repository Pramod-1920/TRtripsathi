{{flutter_js}}
{{flutter_build_config}}

const loading = document.getElementById('app-loading');

_flutter.loader.load({
  onEntrypointLoaded: async function (engineInitializer) {
    try {
      const appRunner = await engineInitializer.initializeEngine();
      await appRunner.runApp();
      loading?.remove();
    } catch (error) {
      console.error('Flutter startup failed:', error);
      if (loading) {
        loading.innerHTML =
          '<div class="brand"><h1>Unable to start TripSathi</h1><p>' +
          String(error) +
          '</p><p>Please refresh the page.</p></div>';
      }
    }
  }
});
