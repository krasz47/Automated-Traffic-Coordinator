use std::env;
use dotenvy::dotenv;

#[derive(Debug, Clone)]
pub struct Config {
    pub opensky_username: Option<String>,
    pub opensky_password: Option<String>,
    pub server_port: u16,
}

impl Config {
    pub fn from_env() -> Self {
        dotenv().ok();
        
        let opensky_username = env::var("OPENSKY_USERNAME").ok();
        let opensky_password = env::var("OPENSKY_PASSWORD").ok();
        let server_port = env::var("SERVER_PORT")
            .unwrap_or_else(|_| "3000".to_string())
            .parse()
            .expect("SERVER_PORT must be a number");

        Config {
            opensky_username,
            opensky_password,
            server_port,
        }
    }
}
