<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Google sign-in</title>
    <style>
        :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
        * { box-sizing: border-box; }
        body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0b120d; color: #eef8ea; }
        main { width: min(390px, calc(100% - 32px)); padding: 32px; text-align: center; border: 1px solid #9bcf8233; border-radius: 20px; background: #121b15; box-shadow: 0 24px 72px #0008; }
        .mark { width: 58px; height: 58px; margin: 0 auto 18px; display: grid; place-items: center; border-radius: 18px; background: #9bcf82; color: #142016; font-size: 26px; font-weight: 900; }
        h1 { margin: 0; font-size: 21px; }
        p { margin: 10px 0 0; color: #aebcaf; font-size: 14px; line-height: 1.6; }
    </style>
</head>
<body>
    <main>
        <div class="mark" aria-hidden="true">G</div>
        <h1 id="status-title">Returning to Plant Growth Academy</h1>
        <p id="status-copy">You can close this window if it does not close automatically.</p>
    </main>
    <script>
        const payload = {{ Illuminate\Support\Js::from($payload) }};
        const frontendOrigin = {{ Illuminate\Support\Js::from($frontendOrigin) }};

        if (window.opener && !window.opener.closed) {
            window.opener.postMessage(payload, frontendOrigin);
            window.setTimeout(() => window.close(), 180);
        } else {
            document.getElementById('status-title').textContent = payload.error ? 'Google sign-in could not finish' : 'Google sign-in complete';
            document.getElementById('status-copy').textContent = payload.error || 'Return to Plant Growth Academy to continue.';
        }
    </script>
</body>
</html>
