<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Password reset code</title>
</head>
<body style="margin:0;background:#eef3ed;font-family:Arial,sans-serif;color:#172019">
    <div style="max-width:560px;margin:0 auto;padding:32px 16px">
        <div style="overflow:hidden;border:1px solid #d4e1d0;border-radius:16px;background:#ffffff;box-shadow:0 12px 36px rgba(25,45,27,.1)">
            <div style="padding:24px 28px;background:#101511;color:#efffe8">
                <div style="font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#9bcf82">Plant Growth Academy</div>
                <h1 style="margin:10px 0 0;font-size:22px">Reset your password</h1>
            </div>
            <div style="padding:28px">
                <p style="margin:0 0 14px">Hello {{ $username }},</p>
                <p style="margin:0;color:#526257;line-height:1.6">Enter this one-time code in Plant Growth Academy. It expires in {{ $expiresInMinutes }} minutes.</p>
                <div style="margin:24px 0;padding:18px;border:1px solid #cfe2c8;border-radius:12px;background:#f5faf3;text-align:center;font-size:32px;font-weight:800;letter-spacing:.28em;color:#284622">{{ $otp }}</div>
                <p style="margin:0;color:#6b786e;font-size:13px;line-height:1.6">If you did not request a password reset, you can safely ignore this email. Never share this code with anyone.</p>
            </div>
        </div>
    </div>
</body>
</html>
