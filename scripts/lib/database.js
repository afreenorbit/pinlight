import pg from 'pg';
import {readFile} from 'node:fs/promises';
export async function databaseClient(env=process.env){
 if(!env.DATABASE_URL)throw Error('Set server-only DATABASE_URL before connecting.');
 const url=new URL(env.DATABASE_URL);
 // The explicit TLS settings take precedence over libpq-style URL switches.
 for(const key of ['sslmode','sslrootcert','sslcert','sslkey'])url.searchParams.delete(key);
 const ca=env.DATABASE_SSL_CA?await readFile(env.DATABASE_SSL_CA,'utf8'):undefined;
 return new pg.Client({connectionString:url.toString(),connectionTimeoutMillis:15000,ssl:{rejectUnauthorized:true,...(ca?{ca}:{})}});
}
