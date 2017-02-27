const THREE = require('three');

import Metaball from './metaball.js';
import InspectPoint from './inspect_point.js'
import LUT from './marching_cube_LUT.js';
var VISUAL_DEBUG = true;

const LAMBERT_WHITE = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
const LAMBERT_GREEN = new THREE.MeshBasicMaterial( { color: 0x00ee00, transparent: true, opacity: 0.5 });
const WIREFRAME_MAT = new THREE.LineBasicMaterial( { color: 0xffffff, linewidth: 10 } );


export default class MarchingCubes {

  constructor(App) {      
    this.init(App);
  }

  init(App) {
    this.isPaused = false;    
    VISUAL_DEBUG = App.config.visualDebug;

    // Initializing member variables.
    // Additional variables are used for fast computation.
    this.origin = new THREE.Vector3(0);

    this.isolevel = App.config.isolevel;
    this.minRadius = App.config.minRadius;
    this.maxRadius = App.config.maxRadius;

    this.gridCellWidth = App.config.gridCellWidth;
    this.halfCellWidth = App.config.gridCellWidth / 2.0;
    this.gridWidth = App.config.gridWidth;

    this.res = App.config.gridRes;
    this.res2 = App.config.gridRes * App.config.gridRes;
    this.res3 = App.config.gridRes * App.config.gridRes * App.config.gridRes;

    this.maxSpeed = App.config.maxSpeed;
    this.numMetaballs = App.config.numMetaballs;

    this.camera = App.camera;
    this.scene = App.scene;

    this.voxels = [];
    this.labels = [];
    this.balls = [];

    this.showSpheres = true;
    this.showGrid = true;

    if (App.config.material) {
      this.material = new THREE.MeshPhongMaterial({ color: 0xff6a1d});
    } else {
      this.material = App.config.material;
    }

    this.setupCells();
    this.setupMetaballs();
    this.makeMesh();
      
    //mesh triangles
    //this.meshTris = [];  
      
  };

  // Convert from 1D index to 3D indices
  i1toi3(i1) {

    // [i % w, i % (h * w)) / w, i / (h * w)]

    // @note: ~~ is a fast substitute for Math.floor()
    return [
      i1 % this.res,
      ~~ ((i1 % this.res2) / this.res),
      ~~ (i1 / this.res2)
      ];
  };

  // Convert from 3D indices to 1 1D
  i3toi1(i3x, i3y, i3z) {

    // [x + y * w + z * w * h]

    return i3x + i3y * this.res + i3z * this.res2;
  };

  // Convert from 3D indices to 3D positions
  i3toPos(i3) {

    return new THREE.Vector3(
      i3[0] * this.gridCellWidth + this.origin.x + this.halfCellWidth,
      i3[1] * this.gridCellWidth + this.origin.y + this.halfCellWidth,
      i3[2] * this.gridCellWidth + this.origin.z + this.halfCellWidth
      );
  };

  setupCells() {

    // Allocate voxels based on our grid resolution
    this.voxels = [];
    for (var i = 0; i < this.res3; i++) {
      var i3 = this.i1toi3(i);
      var {x, y, z} = this.i3toPos(i3);
      var voxel = new Voxel(new THREE.Vector3(x, y, z), this.gridCellWidth);
      this.voxels.push(voxel);

      if (VISUAL_DEBUG) {
        this.scene.add(voxel.wireframe);
        this.scene.add(voxel.mesh);
      }
    }    
  }

  setupMetaballs() {

    this.balls = [];

    var x, y, z, vx, vy, vz, radius, pos, vel;
    var matLambertWhite = LAMBERT_WHITE;
    var maxRadiusTRippled = this.maxRadius * 3;
    var maxRadiusDoubled = this.maxRadius * 2;

    // Randomly generate metaballs with different sizes and velocities
    //console.log(this.numMetaballs);  
    for (var i = 0; i < this.numMetaballs; i++) {
      x = this.gridWidth / 2;    
      y = this.gridWidth / 2;    
      z = this.gridWidth / 2;    
      pos = new THREE.Vector3(x, y, z);
      
      vx = (Math.random() * 2 - 1) * this.maxSpeed;
      vy = (Math.random() * 2 - 1) * this.maxSpeed;
      vz = (Math.random() * 2 - 1) * this.maxSpeed;
      vel = new THREE.Vector3(vx, vy, vz);
      
      radius = Math.random() * (this.maxRadius - this.minRadius) + this.minRadius;
  
      var ball = new Metaball(pos, radius, vel, this.gridWidth, VISUAL_DEBUG);
      this.balls.push(ball);
      
      if (VISUAL_DEBUG) {
        this.scene.add(ball.mesh);
      }
    }
  }

  // This function samples a point from the metaball's density function
  // Implement a function that returns the value of the all metaballs influence to a given point.
  // Please follow the resources given in the write-up for details.
  sample(point) {
    // @TODO // @ DONE
    
      var isovalue = 0.0;
      
      for(var i = 0; i < this.numMetaballs; i++){
          isovalue += this.balls[i].radius2 / ( ( ( point.x - this.balls[i].mesh.position.x ) * ( point.x - this.balls[i].mesh.position.x ) ) + ( ( point.y - this.balls[i].mesh.position.y ) * ( point.y - this.balls[i].mesh.position.y ) ) + ( ( point.z - this.balls[i].mesh.position.z ) * ( point.z - this.balls[i].mesh.position.z ) ) );
          
      }
      
    
    return isovalue;
  }

  update() {

    if (this.isPaused) {
      return;
    }

    // This should move the metaballs
    this.balls.forEach(function(ball) {
      ball.update();
    });

    for (var c = 0; c < this.res3; c++) {

      // Sampling the center point
      this.voxels[c].center.isovalue = this.sample(this.voxels[c].center.pos);
        
      // Sampling the corner points // @ DONE
      this.voxels[c].topRightF.isovalue = this.sample(this.voxels[c].topRightF.pos);
      this.voxels[c].bottomRightF.isovalue = this.sample(this.voxels[c].bottomRightF.pos);
      this.voxels[c].bottomLeftF.isovalue = this.sample(this.voxels[c].bottomLeftF.pos);
      this.voxels[c].topLeftF.isovalue = this.sample(this.voxels[c].topLeftF.pos);
      
      this.voxels[c].topRightB.isovalue = this.sample(this.voxels[c].topRightB.pos);
      this.voxels[c].bottomRightB.isovalue = this.sample(this.voxels[c].bottomRightB.pos);
      this.voxels[c].bottomLeftB.isovalue = this.sample(this.voxels[c].bottomLeftB.pos);
      this.voxels[c].topLeftB.isovalue = this.sample(this.voxels[c].topLeftB.pos);
        
        
      // Visualizing grid
      if (VISUAL_DEBUG && this.showGrid) {
        
        // Toggle voxels on or off
        if (this.voxels[c].center.isovalue > this.isolevel) {
          this.voxels[c].show();
        } else {
          this.voxels[c].hide();
        }
        this.voxels[c].center.updateLabel(this.camera);
        
        this.voxels[c].topRightF.updateLabel(this.camera);
        this.voxels[c].bottomRightF.updateLabel(this.camera);
        this.voxels[c].bottomLeftF.updateLabel(this.camera);
        this.voxels[c].topLeftF.updateLabel(this.camera);
        
        this.voxels[c].topRightB.updateLabel(this.camera);
        this.voxels[c].bottomRightB.updateLabel(this.camera);
        this.voxels[c].bottomLeftB.updateLabel(this.camera);
        this.voxels[c].topLeftB.updateLabel(this.camera);
          
      } else {
        this.voxels[c].center.clearLabel();
          
        this.voxels[c].topRightF.clearLabel();
        this.voxels[c].bottomRightF.clearLabel();
        this.voxels[c].bottomLeftF.clearLabel();
        this.voxels[c].topLeftF.clearLabel();
        
        this.voxels[c].topRightB.clearLabel();
        this.voxels[c].bottomRightB.clearLabel();
        this.voxels[c].bottomLeftB.clearLabel();
        this.voxels[c].topLeftB.clearLabel();
          
      }
    }

    this.updateMesh();
  }

  pause() {
    this.isPaused = true;
  }

  play() {
    this.isPaused = false;
  }

  show() {
    for (var i = 0; i < this.res3; i++) {
      this.voxels[i].show();
    }
    this.showGrid = true;
  };

  hide() {
    for (var i = 0; i < this.res3; i++) {
      this.voxels[i].hide();
    }
    this.showGrid = false;
  };

  makeMesh() {
    // @TODO
      
      //an array of triangle mesh elements which will be used to draw mesh on screen later
      var trisMesh = [];
      
      //debugger;
      //looping through all the voxels and creating the triangle meshes
      for (var c = 0; c < this.res3; c++){
          var poly = this.voxels[c].polygonize(this.isolevel, this.scene);

//          for(var j = 0; LUT.TRI_TABLE[poly.triIndex * 16 + j] != -1; j+=3){
//                var geom = new THREE.Geometry();
//                geom.vertices.push(poly.vertPositions[LUT.TRI_TABLE[poly.triIndex * 16 + j]]);
//                geom.vertices.push(poly.vertPositions[LUT.TRI_TABLE[poly.triIndex * 16 + j + 1]]);
//                geom.vertices.push(poly.vertPositions[LUT.TRI_TABLE[poly.triIndex * 16 + j + 2]]);
//            
//                console.log("vert 1: " + poly.vertPositions[LUT.TRI_TABLE[poly.triIndex * 16 + j]]);
//                console.log("vert 2: " + poly.vertPositions[LUT.TRI_TABLE[poly.triIndex * 16 + j + 1]]);
//                console.log("vert 3: " + poly.vertPositions[LUT.TRI_TABLE[poly.triIndex * 16 + j + 2]]);
//              
//                geom.faces.push( new THREE.Face3( 0, 1, 2 ) );
//                var mesh= new THREE.Mesh( geom, LAMBERT_WHITE );
//                
//                trisMesh.push(mesh); 
//          }     
      }
      //debugger;
      //this.DisplayTrisMesh(trisMesh);
      
  }

  DisplayTrisMesh(MA)
  {
      //how do you clean the scene before adding new mesh?????
      
      for(var i = 0; i < MA.length; i++){
          //debugger;
          this.scene.add(MA[i]);
      }
  }
    
  updateMesh() {
    // @TODO
      for (var c = 0; c < this.res3; c++){
        var poly = this.voxels[c].polygonize(this.isolevel, this.scene);

        this.DisplayTrisMesh(poly);  
      }
  }  
};

// ------------------------------------------- //

class Voxel {

  constructor(position, gridCellWidth) {
    this.init(position, gridCellWidth);
  }

  init(position, gridCellWidth) {
    this.pos = position;
    this.gridCellWidth = gridCellWidth;

    if (VISUAL_DEBUG) {
      this.makeMesh();
    }
    
    this.makeInspectPoints();      
  }

  makeMesh() {
    var halfGridCellWidth = this.gridCellWidth / 2.0;

    var positions = new Float32Array([
      // Front face
       halfGridCellWidth, halfGridCellWidth,  halfGridCellWidth,
       halfGridCellWidth, -halfGridCellWidth, halfGridCellWidth,
      -halfGridCellWidth, -halfGridCellWidth, halfGridCellWidth,
      -halfGridCellWidth, halfGridCellWidth,  halfGridCellWidth,

      // Back face
      -halfGridCellWidth,  halfGridCellWidth, -halfGridCellWidth,
      -halfGridCellWidth, -halfGridCellWidth, -halfGridCellWidth,
       halfGridCellWidth, -halfGridCellWidth, -halfGridCellWidth,
       halfGridCellWidth,  halfGridCellWidth, -halfGridCellWidth,
    ]);

    var indices = new Uint16Array([
      0, 1, 2, 3,
      4, 5, 6, 7,
      0, 7, 7, 4,
      4, 3, 3, 0,
      1, 6, 6, 5,
      5, 2, 2, 1
    ]);

    // Buffer geometry
    var geo = new THREE.BufferGeometry();
    geo.setIndex( new THREE.BufferAttribute( indices, 1 ) );
    geo.addAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );

    // Wireframe line segments
    this.wireframe = new THREE.LineSegments( geo, WIREFRAME_MAT );
    this.wireframe.position.set(this.pos.x, this.pos.y, this.pos.z);

    // Green cube
    geo = new THREE.BoxBufferGeometry(this.gridCellWidth, this.gridCellWidth, this.gridCellWidth);
    this.mesh = new THREE.Mesh( geo, LAMBERT_GREEN );
    this.mesh.position.set(this.pos.x, this.pos.y, this.pos.z);
  }

  makeInspectPoints() {
    var halfGridCellWidth = this.gridCellWidth / 2.0;
    var x = this.pos.x;
    var y = this.pos.y;
    var z = this.pos.z;
    var red = 0xff0000;

    // Center dot
    this.center = new InspectPoint(new THREE.Vector3(x, y, z), 0, VISUAL_DEBUG);
    
    //front face corners
    this.topRightF = new InspectPoint(new THREE.Vector3(x + halfGridCellWidth, y + halfGridCellWidth, z + halfGridCellWidth), 0, VISUAL_DEBUG);  
    this.bottomRightF = new InspectPoint(new THREE.Vector3(x + halfGridCellWidth, y - halfGridCellWidth, z + halfGridCellWidth), 0, VISUAL_DEBUG);  
    this.bottomLeftF = new InspectPoint(new THREE.Vector3(x - halfGridCellWidth, y - halfGridCellWidth, z + halfGridCellWidth), 0, VISUAL_DEBUG);  
    this.topLeftF = new InspectPoint(new THREE.Vector3(x - halfGridCellWidth, y + halfGridCellWidth, z + halfGridCellWidth), 0, VISUAL_DEBUG); 
      
    //back face corners
    this.topRightB = new InspectPoint(new THREE.Vector3(x + halfGridCellWidth, y + halfGridCellWidth, z - halfGridCellWidth), 0, VISUAL_DEBUG);  
    this.bottomRightB = new InspectPoint(new THREE.Vector3(x + halfGridCellWidth, y - halfGridCellWidth, z - halfGridCellWidth), 0, VISUAL_DEBUG);  
    this.bottomLeftB = new InspectPoint(new THREE.Vector3(x - halfGridCellWidth, y - halfGridCellWidth, z - halfGridCellWidth), 0, VISUAL_DEBUG);  
    this.topLeftB = new InspectPoint(new THREE.Vector3(x - halfGridCellWidth, y + halfGridCellWidth, z - halfGridCellWidth), 0, VISUAL_DEBUG);
      
  }

  show() {
    if (this.mesh) {
      this.mesh.visible = true;
    }
    if (this.wireframe) {
      this.wireframe.visible = true;
    }
  }

  hide() {
    if (this.mesh) {
      this.mesh.visible = false;
    }

    if (this.wireframe) {
      this.wireframe.visible = false;
    }

    if (this.center) {
      this.center.clearLabel();
    }
  }

  vertexInterpolation(isolevel, posA, posB) {

    // @TODO
    //var lerpPos = new THREE.Vector3();
      
    //check if the isovalue of the posA or posB is very close to the isolevel in that case return posA or posB as the point of intersection on this edge
//    if(Math.abs(posA.isovalue - isolevel) < 0.0001)
//        return posA.pos;   
//    if(Math.abs(posB.isovalue - isolevel) < 0.0001)
//        return posB.pos;  
//    if(Math.abs(posA.isovalue - posB.isovalue) < 0.0001)
//        return posA.pos;
//      
//    var t = (isolevel - posA.isovalue) / (posB.isovalue - posA.isovalue);
//    
//    var lerpPos = new THREE.Vector3(posA.pos.x + t * (posB.pos.x - posA.pos.x), posA.pos.y + t * (posB.pos.y - posA.pos.y), posA.pos.z + t * (posB.pos.z - posA.pos.z));  
//    
//    console.log("lerpPos X: " + lerpPos.x);  
//      
//    return lerpPos;
      
      var t = (isolevel - posA.isovalue) / (posB.isovalue - posA.isovalue);
      if(this.compareAgeaterthanB(posA, posB)){
          var P = new THREE.Vector3(0,0,0);
          if(Math.abs(posB.isovalue - posA.isovalue) > 0.00001){
               //debugger;
               P.x = posB.pos.x + (posA.pos.x - posB.pos.x) / (posA.isovalue - posB.isovalue) * (t - posB.isovalue);
               P.y = posB.pos.y + (posA.pos.y - posB.pos.y) / (posA.isovalue - posB.isovalue) * (t - posB.isovalue);
               P.z = posB.pos.z + (posA.pos.z - posB.pos.z) / (posA.isovalue - posB.isovalue) * (t - posB.isovalue);
          }else{
               //debugger;
               P.x = posB.pos.x;
               P.y = posB.pos.y;
               P.z = posB.pos.z;
          }
          
          //debugger;
          //console.log("TOP P: " + P);
          
          return P;
            
              
      }else{
          
          var P = new THREE.Vector3(0,0,0);
          if(Math.abs(posA.isovalue - posB.isovalue) > 0.00001){
               //debugger;
               P.x = posA.pos.x + (posB.pos.x - posA.pos.x) / (posB.isovalue - posA.isovalue) * (t - posA.isovalue);
               P.y = posA.pos.y + (posB.pos.y - posA.pos.y) / (posB.isovalue - posA.isovalue) * (t - posA.isovalue);
               P.z = posA.pos.z + (posB.pos.z - posA.pos.z) / (posB.isovalue - posA.isovalue) * (t - posA.isovalue);
          }else{
               //debugger;
               P.x = posA.pos.x;
               P.y = posA.pos.y;
               P.z = posA.pos.z;
          }
          
          //debugger;
          //console.log("BOTTOM P: " + P);
          
          return P;
          
      }
      
      
      
  }

  compareAgeaterthanB(A, B){
      if(B.pos.x < A.pos.x)
          return true;
      else if(B.pos.x > A.pos.x)
          return false;
      
      if(B.pos.y < A.pos.y)
          return true;
      else if(B.pos.y > A.pos.y)
          return false;
      
      if(B.pos.z < A.pos.z)
          return true;
      else if(B.pos.z > A.pos.z)
          return false;
      
      return false;
  }
  
  polygonize(isolevel, scene) {

    // @TODO
      
    //an array of triangle mesh elements which will be used to draw mesh on screen later
    var trisMesh = [];  
    
    //Array of triangle vertex and normals
    var vertexList = []; //stores the vertex of the triangles formed by ball and voxel edge intersections
    var normalList = []; //stores the normals of the triangles formed by the ball and voxel edge intersections
      
    //creating the cube index by checkig how many vertices of the voxel are inside the balls
    var cubeindex = 0;
      
    if(this.bottomLeftB.isovalue > isolevel) cubeindex |= 1;  
    if(this.bottomRightB.isovalue > isolevel) cubeindex |= 2;  
    if(this.bottomRightF.isovalue > isolevel) cubeindex |= 4;  
    if(this.bottomLeftF.isovalue > isolevel) cubeindex |= 8;  
    
    if(this.topLeftB.isovalue > isolevel) cubeindex |= 16;  
    if(this.topRightB.isovalue > isolevel) cubeindex |= 32;  
    if(this.topRightF.isovalue > isolevel) cubeindex |= 64;  
    if(this.topLeftF.isovalue > isolevel) cubeindex |= 128;  
    
    //check if the cube is completely in or out of the surface if so return 0
    
      
    if(LUT.EDGE_TABLE[cubeindex] === 0){
//         return {
//            vertPositions: vertexList,
//            vertNormals: normalList,       
//            triIndex: cubeindex    
//         };
        return trisMesh;
    }else{  
      
    //check which edge has the intersection from the 12 edges and interpolate the intersection point
    if(LUT.EDGE_TABLE[cubeindex] & 1){
        vertexList[0] = (this.vertexInterpolation(isolevel, this.bottomLeftB, this.bottomRightB));
    }
    if(LUT.EDGE_TABLE[cubeindex] & 2){
        vertexList[1] = (this.vertexInterpolation(isolevel, this.bottomRightB, this.bottomRightF));
    }
    if(LUT.EDGE_TABLE[cubeindex] & 4){
        vertexList[2] = (this.vertexInterpolation(isolevel, this.bottomRightF, this.bottomLeftF));
    }  
    if(LUT.EDGE_TABLE[cubeindex] & 8){
        vertexList[3] = (this.vertexInterpolation(isolevel, this.bottomLeftF, this.bottomLeftB));
    }    
    if(LUT.EDGE_TABLE[cubeindex] & 16){
        vertexList[4] = (this.vertexInterpolation(isolevel, this.topLeftB, this.topRightB));
    }
    if(LUT.EDGE_TABLE[cubeindex] & 32){
        vertexList[5] = (this.vertexInterpolation(isolevel, this.topRightB, this.topRightF));
    }  
    if(LUT.EDGE_TABLE[cubeindex] & 64){
        vertexList[6] = (this.vertexInterpolation(isolevel, this.topRightF, this.topLeftF));
    }
    if(LUT.EDGE_TABLE[cubeindex] & 128){
        vertexList[7] = (this.vertexInterpolation(isolevel, this.topLeftF, this.topLeftB));
    }
    if(LUT.EDGE_TABLE[cubeindex] & 256){
        vertexList[8] = (this.vertexInterpolation(isolevel, this.bottomLeftB, this.topLeftB));
    }  
    if(LUT.EDGE_TABLE[cubeindex] & 512){
        vertexList[9] = (this.vertexInterpolation(isolevel, this.bottomRightB, this.topRightB));
    }
    if(LUT.EDGE_TABLE[cubeindex] & 1024){
        vertexList[10] = (this.vertexInterpolation(isolevel, this.bottomRightF, this.topRightF));
    }
    if(LUT.EDGE_TABLE[cubeindex] & 2048){
        vertexList[11] = (this.vertexInterpolation(isolevel, this.bottomLeftF, this.topLeftF));
    }  
    
    //calculating the normals... how???

      
//  vertPositions: vertPositions,
//  vertNormals: vertNormals,   
//    return {
//      vertPositions: vertexList,
//      vertNormals: normalList,       
//      triIndex: cubeindex    
//    };
        
      
    //looping through all the voxels and creating the triangle meshes
    for(var j = 0; LUT.TRI_TABLE[cubeindex * 16 + j] != -1; j+=3){
        var geom = new THREE.Geometry();
        geom.vertices.push(vertexList[LUT.TRI_TABLE[cubeindex * 16 + j]]);
        geom.vertices.push(vertexList[LUT.TRI_TABLE[cubeindex * 16 + j + 1]]);
        geom.vertices.push(vertexList[LUT.TRI_TABLE[cubeindex * 16 + j + 2]]);
            
//        console.log("vert 1: " + vertexList[LUT.TRI_TABLE[cubeindex * 16 + j]]);
//        console.log("vert 2: " + vertexList[LUT.TRI_TABLE[cubeindex * 16 + j + 1]]);
//        console.log("vert 3: " + vertexList[LUT.TRI_TABLE[cubeindex * 16 + j + 2]]);
              
        geom.faces.push( new THREE.Face3( 0, 1, 2 ) );
        var mesh= new THREE.Mesh( geom, LAMBERT_WHITE );
                
        trisMesh.push(mesh); 
    }     
      
    return trisMesh;    
      //console.log("triangle mesh length: " + trisMesh.length);    
//      debugger;
//      this.DisplayTrisMesh(trisMesh, scene);    
    
  }
  };

  DisplayTrisMesh(MA, scene)
  {
      for(var i = 0; i < MA.length; i++){
          //debugger;
          scene.add(MA[i]);
      }
  };
    
}