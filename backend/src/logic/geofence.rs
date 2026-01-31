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
