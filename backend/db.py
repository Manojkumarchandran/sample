import os
from supabase import create_client, Client

def user_client(token: str) -> Client:
    supabase_key = os.getenv("SUPABASE_PUBLISHABLE_KEY") or os.environ["SUPABASE_ANON_KEY"]
    client = create_client(os.environ["SUPABASE_URL"], supabase_key)
    client.postgrest.auth(token)
    return client
