declare module 'proj4leaflet' {
  import * as L from 'leaflet';

  namespace Proj {
    class CRS extends L.Class implements L.CRS {
      constructor(
        code: string,
        proj4def: string,
        options?: {
          resolutions?: number[];
          origin?: [number, number];
          bounds?: L.BoundsExpression;
          transformation?: L.Transformation;
        }
      );

      projection: L.Projection;
      transformation: L.Transformation;
      code: string;
      infinite: boolean;

      latLngToPoint(latlng: L.LatLngExpression, zoom: number): L.Point;
      pointToLatLng(point: L.PointExpression, zoom: number): L.LatLng;
      project(latlng: L.LatLng | L.LatLngLiteral): L.Point;
      unproject(point: L.PointExpression): L.LatLng;
      scale(zoom: number): number;
      zoom(scale: number): number;
      getProjectedBounds(zoom: number): L.Bounds;
      distance(latlng1: L.LatLngExpression, latlng2: L.LatLngExpression): number;
      wrapLatLng(latlng: L.LatLng | L.LatLngLiteral): L.LatLng;
      wrapLatLngBounds(bounds: L.LatLngBounds): L.LatLngBounds;
    }
  }

  // Augment the Leaflet namespace
  module 'leaflet' {
    namespace Proj {
      class CRS extends L.Class implements L.CRS {
        constructor(
          code: string,
          proj4def: string,
          options?: {
            resolutions?: number[];
            origin?: [number, number];
            bounds?: L.BoundsExpression;
            transformation?: L.Transformation;
          }
        );

        projection: L.Projection;
        transformation: L.Transformation;
        code: string;
        infinite: boolean;

        latLngToPoint(latlng: L.LatLngExpression, zoom: number): L.Point;
        pointToLatLng(point: L.PointExpression, zoom: number): L.LatLng;
        project(latlng: L.LatLng | L.LatLngLiteral): L.Point;
        unproject(point: L.PointExpression): L.LatLng;
        scale(zoom: number): number;
        zoom(scale: number): number;
        getProjectedBounds(zoom: number): L.Bounds;
        distance(latlng1: L.LatLngExpression, latlng2: L.LatLngExpression): number;
        wrapLatLng(latlng: L.LatLng | L.LatLngLiteral): L.LatLng;
        wrapLatLngBounds(bounds: L.LatLngBounds): L.LatLngBounds;
      }
    }
  }
}
