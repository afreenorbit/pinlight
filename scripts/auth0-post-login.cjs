// Add as an Auth0 Post Login Action, deploy it, then attach it to the Login flow.
// Only the ID token is used with Supabase. Access tokens authorize Pinlight's API.
exports.onExecutePostLogin=async(event,api)=>{
 if(event.client.client_id==='mZNlXoauoS9kWmXy9gqywJ5PKHmQVNPG')api.idToken.setCustomClaim('role','authenticated');
};
