/* GLOBAL CONSTANTS AND VARIABLES */

/* assignment specific globals */
const WIN_Z = 0;  // default graphics window z coord in world space
const WIN_LEFT = 0; const WIN_RIGHT = 1;  // default left and right x coords in world space
const WIN_BOTTOM = 0; const WIN_TOP = 1;  // default top and bottom y coords in world space
const INPUT_TRIANGLES_URL = "triangles2.json"; // triangles file loc
const INPUT_ELLIPSOIDS_URL = "https://ncsucgclass.github.io/prog3/ellipsoids.json";
//const INPUT_SPHERES_URL = "https://ncsucgclass.github.io/prog3/spheres.json"; // spheres file loc

// Uniform locations
var eyePositionUniform;
var lightPositionUniform;
var lightColorUniform;
var ambientColorUniform;
var diffuseColorUniform;
var specularColorUniform;
var shininessUniform;

var inputTriangles;

var Eye = new vec4.fromValues(0.5, 0.5, -0.5, 1.0); // default eye position in world space
var viewUp = new vec3.fromValues(0, 1, 0); // default look up
var viewAt = new vec3.fromValues(0, 0, 1);

var light = new vec3.fromValues(-0.5, 1.5, -0.5);
var lightColor = new vec3.fromValues(1, 1, 1);

// Define speed of translation and rotation
var translationSpeed = 0.1;
var rotationSpeed = 0.05;

var yaw = 0;  // Rotation around Y-axis
var pitch = 0;  // Rotation around X-axis

/* webgl globals */
var gl = null; // the all powerful gl object. It's all here folks!
var vertexBuffer; // this contains vertex coordinates in triples
var vertexNormal;
var indexBuffer; // this contains indices into vertexBuffer in triples
var normalBuffer;
var triBufferSize = 0;
var triangleBuffer; // this contains indices into vertexBuffer in triples
var altPosition; // flag indicating whether to alter vertex positions
var vertexPositionAttrib; // where to put position for vertex shader
var vertexNormalAttrib; // what colors to put for vertex shader
var altPositionUniform; // where to put altPosition flag for vertex shader
var shaderProgram;
var currentTriangleSet = 0;

var selectedSet = 0;

var axisX = new vec3.fromValues(1, 0, 0);
var axisY = new vec3.fromValues(0, 1, 0);
var axisZ = new vec3.fromValues(0, 0, 1);

// ASSIGNMENT HELPER FUNCTIONS

// get the JSON file from the passed URL
function getJSONFile(url, descr) {
    try {
        if ((typeof (url) !== "string") || (typeof (descr) !== "string"))
            throw "getJSONFile: parameter not a string";
        else {
            var httpReq = new XMLHttpRequest(); // a new http request
            httpReq.open("GET", url, false); // init the request
            httpReq.send(null); // send the request
            var startTime = Date.now();
            while ((httpReq.status !== 200) && (httpReq.readyState !== XMLHttpRequest.DONE)) {
                if ((Date.now() - startTime) > 3000)
                    break;
            } // until its loaded or we time out after three seconds
            if ((httpReq.status !== 200) || (httpReq.readyState !== XMLHttpRequest.DONE))
                throw "Unable to open " + descr + " file!";
            else
                return JSON.parse(httpReq.response);
        } // end if good params
    } // end try    

    catch (e) {
        console.log(e);
        return (String.null);
    }
} // end get input spheres

// set up the webGL environment
function setupWebGL() {

    // Get the canvas and context
    var canvas = document.getElementById("myWebGLCanvas"); // create a js canvas
    gl = canvas.getContext("webgl"); // get a webgl object from it

    try {
        if (gl == null) {
            throw "unable to create gl context -- is your browser gl ready?";
        } else {
            gl.clearColor(0.0, 0.0, 0.0, 1.0); // use black when we clear the frame buffer
            gl.clearDepth(1.0); // use max when we clear the depth buffer
            gl.enable(gl.DEPTH_TEST); // use hidden surface removal (with zbuffering)
        }
    } // end try

    catch (e) {
        console.log(e);
    } // end catch

} // end setupWebGL

// read triangles in, load them into webgl buffers
function loadTriangles() { // CREATES BUFFERS
    inputTriangles = getJSONFile(INPUT_TRIANGLES_URL, "triangles");
    if (inputTriangles != String.null) {
        var whichSetVert; // index of vertex in current triangle set
        var whichSetTri; // index of triangle in current triangle set

        var coordArray = []; // 1D array of vertex coords for WebGL
        var normalArray = [];
        var indexArray = [];  // 1D array of vertex indices for WebGL

        var indexOffset = 0;  // keep track of the current index offset for the current triangle set
        var indexStarts = [];  // Starting index for each triangle set in indexArray
        var indexCounts = [];  // Number of indices for each triangle set

        for (var whichSet = 0; whichSet < inputTriangles.length; whichSet++) {

            inputTriangles[whichSet].mMatrix = mat4.create();
            // set up the vertex coord array
            for (whichSetVert = 0; whichSetVert < inputTriangles[whichSet].vertices.length; whichSetVert++) {
                coordArray = coordArray.concat(inputTriangles[whichSet].vertices[whichSetVert]);
                normalArray = normalArray.concat(inputTriangles[whichSet].normals[whichSetVert]);
            }

            indexStarts.push(indexArray.length); // adding the set starting index to load colors of that particular set
            for (whichSetTri = 0; whichSetTri < inputTriangles[whichSet].triangles.length; whichSetTri++) {
                var tri = inputTriangles[whichSet].triangles[whichSetTri];
                // Add offset to the indices to handle multiple sets
                indexArray = indexArray.concat([tri[0] + indexOffset, tri[1] + indexOffset, tri[2] + indexOffset]);
            }
            indexCounts.push(inputTriangles[whichSet].triangles.length * 3);

            indexOffset += inputTriangles[whichSet].vertices.length;

        } // end for each triangle set 
        // console.log(coordArray.length);
        // send the vertex coords to webGL
        vertexBuffer = gl.createBuffer(); // init empty vertex coord buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer); // activate that buffer
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(coordArray), gl.STATIC_DRAW); // coords to that buffer

        // Send the triangle indices to WebGL
        indexBuffer = gl.createBuffer();  // Init empty index buffer
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);  // Activate that buffer
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indexArray), gl.STATIC_DRAW);  // Indices to that buffer

        //color bubffer
        normalBuffer = gl.createBuffer();  // Init empty vertex coord buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);  // Activate that buffer
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normalArray), gl.STATIC_DRAW);

        triBufferSize = indexArray.length;  // Number of indices
        //adding the indexStart and end in the inputTriangles
        inputTriangles.indexStarts = indexStarts;
        inputTriangles.indexCounts = indexCounts;

    } // end if triangles found
} // end load triangles

// setup the webGL shaders
function setupShaders() {

    // define fragment shader in essl using es6 template strings
    var fShaderCode = `
        precision mediump float;
        varying vec3 fragNormal;
        varying vec3 fragPosition;

        uniform vec3 eyePosition;     
        uniform vec3 lightPosition;   
        uniform vec3 lightColor;      
        uniform vec3 ambientColor;    
        uniform vec3 diffuseColor;    
        uniform vec3 specularColor;   
        uniform float shininess;      

        void main(void) {
            // Normalizing every vector
            vec3 normal = normalize(fragNormal);
            vec3 lightDir = normalize(lightPosition - fragPosition);
            vec3 viewDir = normalize(eyePosition - fragPosition);

            // Calculate ambient component
            vec3 ambient = ambientColor * lightColor;

            // Calculate diffuse component
            float nDotL = max(dot(normal, lightDir), 0.0);
            vec3 diffuse = nDotL * diffuseColor * lightColor;

            // Calculate specular component
            vec3 halfVector = normalize(lightDir + viewDir);
            float spec = pow(max(dot(normal, halfVector), 0.0), shininess);
            vec3 specular = spec * specularColor * lightColor;

            // final color
            vec3 finalColor = ambient + diffuse + specular;
            gl_FragColor = vec4(finalColor, 1.0);
        }
    `;

    // define vertex shader in essl using es6 template strings
    var vShaderCode = `
        uniform mat4 viewMatrix;
        uniform mat4 projectionMatrix;
        uniform mat4 uModelMatrix;

        attribute vec3 vertexPosition;
        attribute vec3 vertexNormal;

        varying vec3 fragPosition;
        varying vec3 fragNormal;

        uniform bool altPosition;

        
        void main(void) {
        fragNormal = vertexNormal;

        fragPosition = vertexPosition;
        gl_Position = projectionMatrix * viewMatrix * uModelMatrix * vec4(vertexPosition, 1.0); // use the untransformed position

        }
    `;

    try {
        // console.log("fragment shader: "+fShaderCode);
        var fShader = gl.createShader(gl.FRAGMENT_SHADER); // create frag shader
        gl.shaderSource(fShader, fShaderCode); // attach code to shader
        gl.compileShader(fShader); // compile the code for gpu execution

        // console.log("vertex shader: "+vShaderCode);
        var vShader = gl.createShader(gl.VERTEX_SHADER); // create vertex shader
        gl.shaderSource(vShader, vShaderCode); // attach code to shader
        gl.compileShader(vShader); // compile the code for gpu execution

        if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) { // bad frag shader compile
            throw "error during fragment shader compile: " + gl.getShaderInfoLog(fShader);
            gl.deleteShader(fShader);
        } else if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) { // bad vertex shader compile
            throw "error during vertex shader compile: " + gl.getShaderInfoLog(vShader);
            gl.deleteShader(vShader);
        } else { // no compile errors
            shaderProgram = gl.createProgram(); // create the single shader program
            gl.attachShader(shaderProgram, fShader); // put frag shader in program
            gl.attachShader(shaderProgram, vShader); // put vertex shader in program
            gl.linkProgram(shaderProgram); // link program into gl context

            if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) { // bad program link
                throw "error during shader program linking: " + gl.getProgramInfoLog(shaderProgram);
            } else { // no shader program link errors
                gl.useProgram(shaderProgram); // activate shader program (frag and vert)

                vertexPositionAttrib = gl.getAttribLocation(shaderProgram, "vertexPosition");
                gl.enableVertexAttribArray(vertexPositionAttrib); // input to shader from array

                vertexNormalAttrib = gl.getAttribLocation(shaderProgram, "vertexNormal");
                gl.enableVertexAttribArray(vertexNormalAttrib);


                eyePositionUniform = gl.getUniformLocation(shaderProgram, "eyePosition");
                lightPositionUniform = gl.getUniformLocation(shaderProgram, "lightPosition");
                lightColorUniform = gl.getUniformLocation(shaderProgram, "lightColor");
                ambientColorUniform = gl.getUniformLocation(shaderProgram, "ambientColor");
                diffuseColorUniform = gl.getUniformLocation(shaderProgram, "diffuseColor");
                specularColorUniform = gl.getUniformLocation(shaderProgram, "specularColor");
                shininessUniform = gl.getUniformLocation(shaderProgram, "shininess");

                altPositionUniform = gl.getUniformLocation(shaderProgram, "altPosition");

            } // end if no shader program link errors
        } // end if no compile errors
    } // end try 

    catch (e) {
        console.log(e);
    } // end catch
    altPosition = false;
    setTimeout(function alterPosition() {
        altPosition = !altPosition;
        setTimeout(alterPosition, 2000);
    }, 2000); // switch flag value every 2 seconds
} // end setup shaders


// var bgColor = 0;

// render the loaded model
function renderTriangles() {
    var fieldOfView = 90 * Math.PI / 180;  // in radians
    var aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    var zNear = 0.5;
    var zFar = 100.0;

    var projectionMatrix = mat4.create();
    mat4.perspective(projectionMatrix, fieldOfView, aspect, zNear, zFar);


    var viewMatrix = mat4.create(); // Using gl-matrix library for matrix operations
    mat4.lookAt(viewMatrix, Eye, viewAt, viewUp);  // Create view matrix

    // Set the view matrix as a uniform in the shader
    var viewMatrixUniform = gl.getUniformLocation(shaderProgram, "viewMatrix");
    gl.uniformMatrix4fv(viewMatrixUniform, false, viewMatrix);
    var modelMatrixULoc = gl.getUniformLocation(shaderProgram, "uModelMatrix");
    gl.uniformMatrix4fv(modelMatrixULoc, false, inputTriangles[0].mMatrix);
    gl.uniformMatrix4fv(modelMatrixULoc, false, inputTriangles[1].mMatrix);
    gl.uniformMatrix4fv(modelMatrixULoc, false, inputTriangles[2].mMatrix);
    gl.uniformMatrix4fv(modelMatrixULoc, false, inputTriangles[3].mMatrix);

    //model matrix
    // for(whichSet = 0; ;) {
    //     gl.uniformMatrix4fv(modelMatrixULoc, false, inputTriangles[selectedSet].mMatrix);
    // }
    

    var projectionMatrixUniform = gl.getUniformLocation(shaderProgram, "projectionMatrix");
    gl.uniformMatrix4fv(projectionMatrixUniform, false, projectionMatrix);


    // gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // clear frame/depth buffers
    // bgColor = (bgColor < 1) ? (bgColor + 0.001) : 0;
    // gl.clearColor(bgColor, 0, 0, 1.0);

    requestAnimationFrame(renderTriangles);

    // vertex buffer: activate and feed into vertex shader
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer); // activate
    gl.vertexAttribPointer(vertexPositionAttrib, 3, gl.FLOAT, false, 0, 0); // feed

    //normal buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);  // Activate the index buffer
    gl.vertexAttribPointer(vertexNormalAttrib, 3, gl.FLOAT, false, 0, 0); // feed

    //indexBuffer
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

    gl.uniform3fv(eyePositionUniform, new Float32Array(Eye)); // feeding the gl
    gl.uniform3fv(lightPositionUniform, new Float32Array(light)); // feeding the gl
    gl.uniform3fv(lightColorUniform, new Float32Array(lightColor)); // feeding the gl
    gl.uniform1i(altPositionUniform, altPosition); // feeding the gl

    for (var whichSet = 0; whichSet < inputTriangles.length; whichSet++) {
        var material = inputTriangles[whichSet].material;

        // Send the material properties to the shader
        gl.uniform3fv(ambientColorUniform, new Float32Array(material.ambient));
        gl.uniform3fv(diffuseColorUniform, new Float32Array(material.diffuse));
        gl.uniform3fv(specularColorUniform, new Float32Array(material.specular));
        gl.uniform1f(shininessUniform, material.n);

        // Compute offset for this triangle set
        var indexStart = inputTriangles.indexStarts[whichSet];
        var indexCount = inputTriangles.indexCounts[whichSet];
        var byteOffset = indexStart * 2; // 2 bytes per Uint16 index

        // Draw the triangles
        gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, byteOffset);
    }

    
    if(flag_for_selection) { 
        console.log("flag " , flag_for_selection);
        // calculate centroid
        var centroid = getCentroid(inputTriangles[0].vertices);// 0 --> 1 : 0 -> default?

        mat4.fromTranslation(inputTriangles[0].mMatrix, vec3.negate(vec3.create(),centroid)); // move to origin 000
        mat4.multiply(inputTriangles[0].mMatrix,
            mat4.fromScaling(mat4.create(),vec3.fromValues(2,2,2)),
            inputTriangles[0].mMatrix); // scaling
        // mat4.multiply(inputTriangles[0].mMatrix,mat4.fromRotation(mat4.create(),(thetaX * Math.PI) / 6, axisX),inputTriangles[0].mMatrix);
        // mat4.multiply(inputTriangles[0].mMatrix,mat4.fromRotation(mat4.create(),(thetaY * Math.PI) / 6, axisY),inputTriangles[0].mMatrix);
        // mat4.multiply(inputTriangles[0].mMatrix,mat4.fromRotation(mat4.create(),(thetaZ * Math.PI) / 6, axisZ),inputTriangles[0].mMatrix);//rotaion on all axises

        mat4.multiply(inputTriangles[0].mMatrix, mat4.fromTranslation(mat4.create(),centroid),inputTriangles[0].mMatrix);    
        // mat4.multiply(inputTriangles[0].mMatrix, mat4.fromTranslation(mat4.create(),tmodel),inputTriangles[0].mMatrix);

    }


} // end render triangles

function getCentroid(vertices) {
    let centroid = [0, 0, 0];  // Initialize the centroid at the origin [0, 0, 0]

    // Sum all vertex positions
    vertices.forEach(vertex => {
        centroid[0] += vertex[0];  // Sum of x-coordinates
        centroid[1] += vertex[1];  // Sum of y-coordinates
        centroid[2] += vertex[2];  // Sum of z-coordinates
    });

    // Divide by the number of vertices to get the average (i.e., the centroid)
    let numVertices = vertices.length;
    centroid[0] /= numVertices;
    centroid[1] /= numVertices;
    centroid[2] /= numVertices;

    return centroid;  // Return the computed centroid as [x, y, z]
}


function setupKeyListeners() {
    document.addEventListener('keydown', function (event) {
        switch (event.key) {
            case 'a': // Move view left along X
                moveViewLeft();
                break;
            case 'd': // Move view right along X
                moveViewRight();
                break;
            case 'w': // Move view forward along Z
                moveViewForward();
                break;
            case 's': // Move view backward along Z
                moveViewBackward();
                break;
            case 'q': // Move view up along Y
                moveViewUp();
                break;
            case 'e': // Move view down along Y
                moveViewDown();
                break;

            // Rotation keys (capital letters for rotation)
            case 'A': // Rotate view left (yaw) around Y
                rotateViewLeft();
                break;
            case 'D': // Rotate view right (yaw) around Y
                rotateViewRight();
                break;
            case 'W': // Rotate view forward (pitch) around X
                rotateViewForward();
                break;
            case 'S': // Rotate view backward (pitch) around X
                rotateViewBackward();
                break;
            case 't': {
                flag_for_selection = 1;
                
                currentTriangleSet = (currentTriangleSet + 1) % inputTriangles.length;
                renderTriangles()
            }
            case 'y': {
                flag_for_selection = 1;
                currentTriangleSet = (currentTriangleSet - 1 + inputTriangles.length) % inputTriangles.length;
                // selectNext()
            }
        }
        // renderTriangles();
    });
}

var flag_for_selection = 0;
var moveSpeed = 0.1;
var rotationSpeed = 0.05;

function moveViewLeft() {
    Eye[0] -= moveSpeed;
    viewAt[0] -= moveSpeed;
    // renderTriangles();
}

function moveViewRight() {
    Eye[0] += moveSpeed;
    viewAt[0] += moveSpeed;
}

function moveViewForward() {
    Eye[2] -= moveSpeed;
    viewAt[2] -= moveSpeed;
}

function moveViewBackward() {
    Eye[2] += moveSpeed;
    viewAt[2] += moveSpeed;
}

function moveViewUp() {
    Eye[1] += moveSpeed;
    viewAt[1] += moveSpeed;
}

function moveViewDown() {
    Eye[1] -= moveSpeed;
    viewAt[1] -= moveSpeed;
}

// Rotation functions
function rotateViewLeft() {
    rotateViewAroundY(-rotationSpeed);
}

function rotateViewRight() {
    rotateViewAroundY(rotationSpeed);
}

function rotateViewForward() {
    rotateViewAroundX(-rotationSpeed);
}

function rotateViewBackward() {
    rotateViewAroundX(rotationSpeed);
}

// Implement functions to rotate around X and Y axes
function rotateViewAroundY(angle) {
    var cosAngle = Math.cos(angle);
    var sinAngle = Math.sin(angle);

    var dirX = viewAt[0] - Eye[0];
    var dirZ = viewAt[2] - Eye[2];

    viewAt[0] = Eye[0] + cosAngle * dirX - sinAngle * dirZ;
    viewAt[2] = Eye[2] + sinAngle * dirX + cosAngle * dirZ;
}

function rotateViewAroundX(angle) {
    var cosAngle = Math.cos(angle);
    var sinAngle = Math.sin(angle);

    var dirY = viewAt[1] - Eye[1];
    var dirZ = viewAt[2] - Eye[2];

    viewAt[1] = Eye[1] + cosAngle * dirY - sinAngle * dirZ;
    viewAt[2] = Eye[2] + sinAngle * dirY + cosAngle * dirZ;
}


/* MAIN -- HERE is where execution begins after window load */

function main() {

    setupWebGL(); // set up the webGL environment
    loadTriangles(); // load in the triangles from tri file
    setupShaders(); // setup the webGL shaders
    setupKeyListeners();
    renderTriangles(); // draw the triangles using webGL

} // end main
