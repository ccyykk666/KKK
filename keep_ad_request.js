const headers = { ...$request.headers };

for (const name of Object.keys(headers)) {
  if (name.toLowerCase() === "x-encrypt-code") {
    delete headers[name];
  }
}

$done({ headers });
