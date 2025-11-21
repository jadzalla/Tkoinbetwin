<!DOCTYPE html>
<html lang="{{ app()->getLocale() }}">
<head>
  <title>{{ config('app.name') }}</title>
  <!-- {{ config('app.version') }} -->

  <meta charset="utf-8" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
  <meta name="description" content="{{ __('Fair online casino games') }}" />
  <meta name="keywords" content="casino,blackjack,poker,slots,slot machine,baccarat,dice,roulette,online games" />
  <meta name="theme-color" content="#ffffff">
  <meta name="csrf-token" content="{{ csrf_token() }}">

  <!-- Favicon -->
  <link rel="icon" href="{{ asset(config('settings.favicon.ico')) }}" type="image/x-icon">
  @if(config('settings.favicon.apple_touch'))
    <link rel="apple-touch-icon" sizes="180x180" href="{{ asset(config('settings.favicon.apple_touch')) }}">
  @endif
  @if(config('settings.favicon.32x32'))
    <link rel="icon" sizes="32x32" href="{{ asset(config('settings.favicon.32x32')) }}">
  @endif
  @if(config('settings.favicon.192x192'))
    <link rel="icon" sizes="192x192" href="{{ asset(config('settings.favicon.192x192')) }}">
  @endif
  @if(config('settings.favicon.mask'))
    <link rel="mask-icon" color="#000000" href="{{ asset(config('settings.favicon.mask')) }}">
  @endif
    <!-- END Favicon -->

  <link rel="manifest" href="{{ asset('manifest.json') }}">

  <!--Open Graph tags-->
  <meta property="og:url" content="{{ url('/') }}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="{{ config('app.name') }}" />
  <meta property="og:description" content="{{ __('Fair online casino games') }}" />
  <meta property="og:image" content="{{ asset(config('app.og_image')) }}" />
  <!--END Open Graph tags-->

  <!--Google Tag Manager-->
  @if(config('services.gtm.container_id'))
    <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
          new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
        j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
        'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
      })(window,document,'script','dataLayer', '{{ config('services.gtm.container_id') }}');
    </script>
  @endif
  <!--END Google Tag Manager-->

  <!-- Bootstrap CSS (required for Tkoin Wallet modals) -->
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">

  <!-- Font Awesome (required for Tkoin Wallet icons) -->
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">

  @foreach($stylesheets as $stylesheet)
    <link href="{{ $stylesheet }}" rel="stylesheet">
  @endforeach

  <noscript>
    <h3>{{ __('Please enable JavaScript in your browser.') }}</h3>
  </noscript>
</head>
<body onload="if(window !== window.top) window.top.location = window.location">
  <div id="app"></div>

  <script>
    window.store = "{{ $store }}"
  </script>

  <script src="{{ asset('js/app.js') . '?' . md5(config('app.version')) }}"></script>
  
  <!-- Bootstrap JS (required for Tkoin Wallet modals) -->
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
  
  {!! $javascript !!}
</body>
</html>
