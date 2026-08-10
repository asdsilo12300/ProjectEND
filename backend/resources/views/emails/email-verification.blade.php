<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Verify your email</title>
</head>
<body style="margin:0;background:#edf4ea;font-family:Arial,'Noto Sans Thai',sans-serif;color:#172019">
    <div style="max-width:600px;margin:0 auto;padding:36px 16px">
        <div style="overflow:hidden;border:1px solid #cdddc8;border-radius:20px;background:#fff;box-shadow:0 18px 48px rgba(25,45,27,.12)">
            <div style="padding:28px 32px;background:linear-gradient(135deg,#0c1710,#18351f);color:#f1ffe9">
                <div style="font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#a7db91">Plant Growth Academy</div>
                <h1 style="margin:12px 0 0;font-size:26px;line-height:1.25">Verify your email address</h1>
                <p style="margin:8px 0 0;color:#c8ddc5;font-size:14px">ยืนยันอีเมลเพื่อเริ่มบันทึกการทดลองปลูกพืช</p>
            </div>
            <div style="padding:32px">
                <p style="margin:0 0 14px;font-size:16px">Hello {{ $username }},</p>
                <p style="margin:0;color:#526257;line-height:1.7">Use the button below or enter this one-time code in Plant Growth Academy. Both expire in {{ $expiresInMinutes }} minutes.</p>
                <div style="margin:26px 0 18px;padding:20px;border:1px solid #c9dfc0;border-radius:14px;background:#f3f9f0;text-align:center;font-size:34px;font-weight:900;letter-spacing:.3em;color:#284d26">{{ $otp }}</div>
                <div style="text-align:center">
                    <a href="{{ $verificationUrl }}" style="display:inline-block;border-radius:10px;background:#8fce75;padding:14px 24px;color:#102012;font-size:15px;font-weight:800;text-decoration:none">Verify email / ยืนยันอีเมล</a>
                </div>
                <p style="margin:24px 0 0;color:#6b786e;font-size:13px;line-height:1.7">If you did not create this account, you can safely ignore this email. Never share the code with anyone.</p>
            </div>
        </div>
    </div>
</body>
</html>
