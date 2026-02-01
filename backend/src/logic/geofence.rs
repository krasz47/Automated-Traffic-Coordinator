use geo::{Polygon, Point, Contains};
use geo::coord;

pub struct AirportZones {
    pub runway: Polygon,
    pub taxiway_juliet: Polygon,
    pub taxiway_hotel: Polygon,
}

impl AirportZones {
    pub fn new() -> Self {
        // Approximate polygons for EGSS
        // Runway 04/22: approx 3km long, SW to NE.
        // SW End (04): 51.875, 0.22
        // NE End (22): 51.895, 0.25
        
        // Creating a simple bounding box/polygon around the runway
        let runway = Polygon::new(
            vec![
                coord! { x: 0.219, y: 51.874 },
                coord! { x: 0.221, y: 51.876 },
                coord! { x: 0.251, y: 51.896 },
                coord! { x: 0.249, y: 51.894 },
                coord! { x: 0.219, y: 51.874 },
            ].into(),
            vec![],
        );

        // Taxiway Juliet (Inner/East) - Placeholder
        let taxiway_juliet = Polygon::new(
             vec![
                coord! { x: 0.225, y: 51.875 },
                coord! { x: 0.255, y: 51.895 },
                coord! { x: 0.256, y: 51.894 }, // Width
                coord! { x: 0.226, y: 51.874 },
                coord! { x: 0.225, y: 51.875 },
            ].into(),
            vec![],
        );
        
        // Taxiway Hotel (Outer/East) - Placeholder
        let taxiway_hotel = Polygon::new(
             vec![
                 coord! { x: 0.228, y: 51.876 },
                 coord! { x: 0.258, y: 51.896 },
                 coord! { x: 0.259, y: 51.895 },
                 coord! { x: 0.229, y: 51.875 },
                 coord! { x: 0.228, y: 51.876 },
            ].into(),
            vec![],
        );

        AirportZones {
            runway,
            taxiway_juliet,
            taxiway_hotel,
        }
    }

    pub fn check_zone(&self, lat: f64, lon: f64) -> Option<String> {
        let p = Point::new(lon, lat); // Geo uses (x=lon, y=lat)
        
        if self.runway.contains(&p) {
            return Some("Runway".to_string());
        }
        if self.taxiway_juliet.contains(&p) {
            return Some("TaxiwayJ".to_string());
        }
        if self.taxiway_hotel.contains(&p) {
            return Some("TaxiwayH".to_string());
        }
        None
    }
}

pub fn haversine_distance(lat1: f64, lon1: f64, lat2: f64, lon2: f64) -> f64 {
    let r = 6371.0; // Earth radius in km
    let to_rad = |d: f64| d * std::f64::consts::PI / 180.0;

    let d_lat = to_rad(lat2 - lat1);
    let d_lon = to_rad(lon2 - lon1);
    
    let a = (d_lat / 2.0).sin().powi(2) +
            to_rad(lat1).cos() * to_rad(lat2).cos() *
            (d_lon / 2.0).sin().powi(2);
    
    let c = 2.0 * a.sqrt().atan2((1.0 - a).sqrt());
    
    r * c
}
