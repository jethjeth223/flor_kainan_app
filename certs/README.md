# Supabase database CA

supabase-root.crt is the public Supabase Root 2021 CA, downloaded over HTTPS from:
https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt

It expires April 26, 2031. It is not a private key. The application verifies the
database's TLS chain and hostname with this CA; it never disables certificate
verification. The standalone build traces this file into the runtime image.

Supabase's certificate guidance:
https://supabase.com/docs/guides/platform/ssl-enforcement
