use std::env;
use dotenvy::dotenv;

#[derive(Debug, Clone)]
pub struct AirportConfig {
    pub code: String,
    pub lat: f64,
    pub lon: f64,
    pub radius: u32,
}

#[derive(Debug, Clone)]
pub struct Config {
    pub server_port: u16,
    pub airports: Vec<AirportConfig>,
}

impl Config {
    pub fn from_env() -> Self {
        dotenv().ok();
        
        let server_port = env::var("SERVER_PORT")
            .unwrap_or_else(|_| "3000".to_string())
            .parse()
            .expect("SERVER_PORT must be a number");

        Config {
            server_port,
            airports: vec![
                AirportConfig {
                    code: "EGSS".to_string(),
                    lat: 51.885,
                    lon: 0.235,
                    radius: 25,
                },
                AirportConfig {
                    code: "KLAX".to_string(),
                    lat: 33.942,
                    lon: -118.407,
                    radius: 25,
                }
            ],
        }
    }
}
