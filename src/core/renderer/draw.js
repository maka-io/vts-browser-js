
import {vec3 as vec3_, mat3 as mat3_, mat4 as mat4_} from '../utils/matrix';
import {math as math_} from '../utils/math';
import {processGMap as processGMap_} from './gmap';

//get rid of compiler mess
var vec3 = vec3_, mat3 = mat3_, mat4 = mat4_;
var math = math_;
var processGMap = processGMap_;


var RendererDraw = function(renderer) {
    this.renderer = renderer;
    this.core = renderer.core;
    this.gpu = renderer.gpu;
    this.gl = renderer.gpu.gl;
    this.rmap = renderer.rmap;
};


RendererDraw.prototype.drawSkydome = function(texture, shader) {
    if (!texture) {
        return;
    }

    var gpu = this.gpu;
    var gl = this.gl;
    var renderer = this.renderer;
    
    var lower = 400; // put the dome a bit lower
    var normMat = mat4.create();
    mat4.multiply(math.scaleMatrix(2, 2, 2), math.translationMatrix(-0.5, -0.5, -0.5), normMat);

    var domeMat = mat4.create();

    var pos = renderer.camera.getPosition();
    mat4.multiply(math.translationMatrix(pos[0], pos[1], pos[2] - lower), math.scaleMatrixf(Math.min(renderer.camera.getFar()*0.9,600000)), domeMat);

    var mvp = mat4.create();
    mat4.multiply(renderer.camera.getMvpMatrix(), domeMat, mvp);
    mat4.multiply(mvp, normMat, mvp);


    gpu.useProgram(shader, ['aPosition', 'aTexCoord']);
    gpu.bindTexture(texture);

    shader.setSampler('uSampler', 0);
    shader.setMat4('uMVP', mvp);

    gl.depthMask(false);

    renderer.skydomeMesh.draw(shader, 'aPosition', 'aTexCoord');

    gl.depthMask(true);
    gl.enable(gl.CULL_FACE);

    renderer.renderedPolygons += renderer.skydomeMesh.getPolygons();
};


RendererDraw.prototype.drawTBall = function(position, size, shader, texture, size2, nocull) {
    var gpu = this.gpu;
    var gl = this.gl;
    var renderer = this.renderer;

    if (nocull) {
        gl.disable(gl.CULL_FACE);
    }

    var normMat = mat4.create();
    mat4.multiply(math.scaleMatrix(2, 2, 2), math.translationMatrix(-0.5, -0.5, -0.5), normMat);

    var pos = [position[0], position[1], position[2] ];

    size = (size != null) ? size : 1.5;

    var domeMat = mat4.create();
    mat4.multiply(math.translationMatrix(pos[0], pos[1], pos[2]), math.scaleMatrix(size, size, size2 || size), domeMat);

    var mvp = mat4.create();
    mat4.multiply(renderer.camera.getMvpMatrix(), domeMat, mvp);
    mat4.multiply(mvp, normMat, mvp);

    gpu.useProgram(shader, ['aPosition', 'aTexCoord']);
    gpu.bindTexture(texture || renderer.redTexture);

    shader.setSampler('uSampler', 0);
    shader.setMat4('uMVP', mvp);

    renderer.skydomeMesh.draw(shader, 'aPosition', 'aTexCoord');

    renderer.renderedPolygons += renderer.skydomeMesh.getPolygons();

    if (nocull) {
        gl.enable(gl.CULL_FACE);
    }
};


RendererDraw.prototype.drawBall = function(position, size, size2, shader, params, params2, params3, color, color2, normals) {
    var gpu = this.gpu;
    var gl = this.gl;
    var renderer = this.renderer;

    var normMat = mat4.create();
    mat4.multiply(math.scaleMatrix(2, 2, 2), math.translationMatrix(-0.5, -0.5, -0.5), normMat);

    var pos = [position[0], position[1], position[2] ];

    var domeMat = mat4.create();
    size = size || 1.5;
    size2 = size2 || 1.5;
    mat4.multiply(math.translationMatrix(pos[0], pos[1], pos[2]), math.scaleMatrix(size, size, size2), domeMat);

    var mv = mat4.create();
    mat4.multiply(renderer.camera.getModelviewMatrix(), domeMat, mv);
    mat4.multiply(mv, normMat, mv);
    var proj = renderer.camera.getProjectionMatrix();

    var norm = [0,0,0, 0,0,0, 0,0,0];
    mat4.toInverseMat3(mv, norm);
    mat3.transpose(norm);
    
    gpu.useProgram(shader, ['aPosition']);
    gpu.bindTexture(renderer.redTexture);

    shader.setSampler('uSampler', 0);
    shader.setMat4('uProj', proj);
    shader.setMat4('uMV', mv);
    
    if (normals) {
        shader.setMat3('uNorm', norm);
        gl.cullFace(gl.FRONT);
        //gl.disable(gl.DEPTH_TEST);
    }
    

    if (params) {
        shader.setVec4('uParams', params);
    }

    if (params2) {
        shader.setVec4('uParams2', params2);
    }

    if (params2) {
        shader.setVec4('uParams3', params3);
    }

    if (color) {
        shader.setVec4('uFogColor', color);
    }

    if (color2) {
        shader.setVec4('uFogColor2', color2);
    }

    renderer.atmoMesh.draw(shader, 'aPosition', null /*"aTexCoord"*/);

    renderer.renderedPolygons += renderer.skydomeMesh.getPolygons();

    if (normals) {
        gl.cullFace(gl.BACK);
    }
};


RendererDraw.prototype.drawBall2 = function(position, size, shader, nfactor, dir, radius2) {
    var gpu = this.gpu;
    var renderer = this.renderer;

    var normMat = mat4.create();
    mat4.multiply(math.scaleMatrix(2, 2, 2), math.translationMatrix(-0.5, -0.5, -0.5), normMat);

    var pos = [position[0], position[1], position[2] ];

    var domeMat = mat4.create();
    mat4.multiply(math.translationMatrix(pos[0], pos[1], pos[2]), math.scaleMatrixf(size != null ? size : 1.5), domeMat);

    var mv = mat4.create();
    mat4.multiply(renderer.camera.getModelviewMatrix(), domeMat, mv);
    mat4.multiply(mv, normMat, mv);
    var proj = renderer.camera.getProjectionMatrix();

    var norm = [0,0,0, 0,0,0, 0,0,0];
    mat4.toInverseMat3(mv, norm);
    mat3.transpose(norm);
    
    gpu.useProgram(shader, ['aPosition']);
    gpu.bindTexture(renderer.redTexture);

    shader.setSampler('uSampler', 0);
    shader.setMat4('uProj', proj);
    shader.setMat4('uMV', mv);
    shader.setMat3('uNorm', norm);
    shader.setFloat('uNFactor', nfactor);
    shader.setVec3('uCenter', position);
    shader.setVec2('uRadius', [size, radius2]);

    renderer.atmoMesh.draw(shader, 'aPosition', null /*"aTexCoord"*/);
    renderer.renderedPolygons += renderer.skydomeMesh.getPolygons();
};


RendererDraw.prototype.drawLineString = function(points, screenSpace, size, color, depthOffset, depthTest, transparent, writeDepth, useState) {
    var gpu = this.gpu;
    var gl = this.gl;
    var renderer = this.renderer;
    var index = 0, p, i;

    var totalPoints = points.length; 
   
    if (totalPoints > 32) {
        for (i = 0; i < totalPoints; i += 31) {
            p = points.slice(i, i + 32); 
            this.drawLineString(p, screenSpace, size, color, depthOffset, depthTest, transparent, writeDepth, useState);
        }
        return;
    }

    var plineBuffer = renderer.plineBuffer;


    if (screenSpace) { 

        //fill points
        for (i = 0; i < totalPoints; i++) {
            p = points[i];
            plineBuffer[index] = p[0];
            plineBuffer[index+1] = p[1];
            plineBuffer[index+2] = p[2] || 0;
            index += 3;
        }

    } else { //covert points from physical space

        var mvp = renderer.camera.getMvpMatrix();
        var curSize = renderer.curSize;
        var cameraPos = renderer.cameraPosition;

        for (i = 0; i < totalPoints; i++) {
            p = points[i];
            p = mat4.multiplyVec4(mvp, [p[0] - cameraPos[0], p[1] - cameraPos[1], p[2] - cameraPos[2], 1 ]); 

            //project point coords to screen
            if (p[3] != 0) {
                //x and y are in screen pixels
                plineBuffer[index] = ((p[0]/p[3])+1.0)*0.5*curSize[0];
                plineBuffer[index+1] = (-(p[1]/p[3])+1.0)*0.5*curSize[1]; 
                plineBuffer[index+2] = p[2]/p[3]; //depth in meters
            } else {
                plineBuffer[index] = 0;
                plineBuffer[index+1] = 0;
                plineBuffer[index+2] = 0;
            }

            index += 3;
        }
    }

    if (useState !== true) {
        if (depthTest !== true) {
            gl.disable(gl.DEPTH_TEST);
        }
    
        if (transparent) {
            gl.blendEquationSeparate(gl.FUNC_ADD, gl.FUNC_ADD);
            gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            gl.enable(gl.BLEND);
        }
    
        if (writeDepth === false) {
            gl.depthMask(false); 
        }
    
        gl.disable(gl.CULL_FACE);
    }

    var prog = renderer.progLine4;   

    gpu.useProgram(prog, ['aPosition']);
    prog.setMat4('uMVP', renderer.imageProjectionMatrix, depthOffset ? renderer.getZoffsetFactor(depthOffset) : null);
    prog.setVec3('uScale', [(2 / renderer.curSize[0]), (2 / renderer.curSize[1]), size*0.5]);
    prog.setVec4('uColor', (color != null ? color : [255,255,255,255]));
    prog.setVec3('uPoints', plineBuffer);

    renderer.plines.draw(prog, 'aPosition', totalPoints);

    if (useState !== true) {
        if (depthTest !== true) {
            gl.enable(gl.DEPTH_TEST);
        }
    
        if (transparent) {
            gl.disable(gl.BLEND);
        }
    
        if (writeDepth === false) {
            gl.depthMask(true); 
        }
    
        gl.enable(gl.CULL_FACE);
    }
};


//draw 2d image - used for debuging
RendererDraw.prototype.drawImage = function(x, y, lx, ly, texture, color, depth, depthOffset, depthTest, transparent, writeDepth, useState) {
    var gpu = this.gpu;
    var gl = this.gl;
    var renderer = this.renderer;

    if (texture == null || renderer.imageProjectionMatrix == null) {
        return;
    }

    if (useState !== true) {
        if (depthTest !== true) {
            gl.disable(gl.DEPTH_TEST);
        }
    
        if (transparent) {
            gl.blendEquationSeparate(gl.FUNC_ADD, gl.FUNC_ADD);
            gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            gl.enable(gl.BLEND);
        }
    
        if (writeDepth === false) {
            gl.depthMask(false); 
        }
    
        gl.disable(gl.CULL_FACE);
    }

    var prog = renderer.progImage;

    gpu.useProgram(prog, ['aPosition']);
    gpu.bindTexture(texture);

    var vertices = renderer.rectVerticesBuffer;
    gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
    gl.vertexAttribPointer(prog.getAttribute('aPosition'), vertices.itemSize, gl.FLOAT, false, 0, 0);

    var indices = renderer.rectIndicesBuffer;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices);

    prog.setMat4('uProjectionMatrix', renderer.imageProjectionMatrix);

    prog.setMat4('uData', [
        x, y,  0, 0,
        x + lx, y,  1, 0,
        x + lx, y + ly, 1, 1,
        x,  y + ly,  0, 1  ]);

    if (depthOffset) {
        depth = depth * (1 + renderer.getZoffsetFactor(depthOffset) * 2);
    }

    prog.setVec4('uColor', (color != null ? color : [1,1,1,1]));
    prog.setFloat('uDepth', depth);

    gl.drawElements(gl.TRIANGLES, indices.numItems, gl.UNSIGNED_SHORT, 0);

    if (useState !== true) {
        if (writeDepth === false) {
            gl.depthMask(true); 
        }
    
        if (depthTest !== true) {
            gl.enable(gl.DEPTH_TEST);
        }
    
        if (transparent) {
            gl.disable(gl.BLEND);
        }
    
        gl.enable(gl.CULL_FACE);
    }
};


RendererDraw.prototype.drawBillboard = function(mvp, texture, color, depthOffset, depthTest, transparent, writeDepth, useState) {
    var gpu = this.gpu;
    var gl = this.gl;
    var renderer = this.renderer;

    if (useState !== true) {
        if (depthTest !== true) {
            gl.disable(gl.DEPTH_TEST);
        }
    
        if (transparent) {
            gl.blendEquationSeparate(gl.FUNC_ADD, gl.FUNC_ADD);
            gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            gl.enable(gl.BLEND);
        }
    
        if (writeDepth === false) {
            gl.depthMask(false); 
        }
    
        gl.disable(gl.CULL_FACE);
    }

    var prog = renderer.progImage;

    gpu.useProgram(prog, ['aPosition', 'aTexCoord']);
    gpu.bindTexture(texture);
    prog.setSampler('uSampler', 0);

    var vertices = renderer.rectVerticesBuffer;
    gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
    gl.vertexAttribPointer(prog.getAttribute('aPosition'), vertices.itemSize, gl.FLOAT, false, 0, 0);

    var indices = renderer.rectIndicesBuffer;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices);

    prog.setMat4('uProjectionMatrix', mvp, depthOffset ? renderer.getZoffsetFactor(depthOffset) : null);

    var x = 0, y = 0, lx = 1, ly = 1;

    prog.setMat4('uData', [
        x, y,  0, 0,
        x + lx, y,  1, 0,
        x + lx, y + ly, 1, 1,
        x,  y + ly,  0, 1  ]);

    prog.setVec4('uColor', (color != null ? color : [1,1,1,1]));
    prog.setFloat('uDepth', 0);

    gl.drawElements(gl.TRIANGLES, indices.numItems, gl.UNSIGNED_SHORT, 0);

    if (useState !== true) {
        if (writeDepth === false) {
            gl.depthMask(true); 
        }
    
        if (depthTest !== true) {
            gl.enable(gl.DEPTH_TEST);
        }
    
        if (transparent) {
            gl.disable(gl.BLEND);
        }
    
        gl.enable(gl.CULL_FACE);
    }
};


//draw flat 2d image - used for debuging
RendererDraw.prototype.drawFlatImage = function(x, y, lx, ly, texture, color, depth, depthOffset) {
    var gpu = this.gpu;
    var gl = this.gl;
    var renderer = this.renderer;

    if (texture == null || renderer.imageProjectionMatrix == null) {
        return;
    }

    var prog = renderer.progImage;

    gpu.useProgram(prog, ['aPosition']);
    gpu.bindTexture(texture);

    var vertices = renderer.rectVerticesBuffer;
    gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
    gl.vertexAttribPointer(prog.getAttribute('aPosition'), vertices.itemSize, gl.FLOAT, false, 0, 0);

    var indices = renderer.rectIndicesBuffer;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices);

    prog.setMat4('uProjectionMatrix', renderer.imageProjectionMatrix);

    prog.setMat4('uData', [
        x, y,  0, 0,
        x + lx, y,  1, 0,
        x + lx, y + ly, 1, 1,
        x,  y + ly,  0, 1  ]);

    prog.setVec4('uColor', (color != null ? color : [1,1,1,1]));
    prog.setFloat('uDepth', depth != null ? depth : 0);

    gl.drawElements(gl.TRIANGLES, indices.numItems, gl.UNSIGNED_SHORT, 0);
};


//draw 2d text - used for debuging
RendererDraw.prototype.drawText = function(x, y, size, text, color, depth, useState) {
    var gpu = this.gpu;
    var gl = this.gl;
    var renderer = this.renderer;

    if (renderer.imageProjectionMatrix == null) {
        return;
    }

    if (useState !== true) {
        gl.disable(gl.CULL_FACE);
    
    
        if (depth == null) {
            gl.disable(gl.DEPTH_TEST);
        } else {
            gl.depthFunc(gl.LEQUAL);
            gl.enable(gl.DEPTH_TEST);
        }
    }

    var prog = renderer.progImage;

    gpu.useProgram(prog, ['aPosition']);
    gpu.bindTexture(renderer.textTexture2);

    var vertices = renderer.rectVerticesBuffer;
    gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
    gl.vertexAttribPointer(prog.getAttribute('aPosition'), vertices.itemSize, gl.FLOAT, false, 0, 0);

    var indices = renderer.rectIndicesBuffer;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices);

    prog.setMat4('uProjectionMatrix', renderer.imageProjectionMatrix);
    prog.setVec4('uColor', color);
    prog.setFloat('uDepth', depth != null ? depth : 0);

    var sizeX = size - 1;
    var sizeY = size;

    var sizeX2 = Math.round(size*0.5);

    var texelX = 1 / 256;
    var texelY = 1 / 128;

    var lx = this.getTextSize(size, text) + 2;

    //draw black line before text
    var char = 0;
    var charPosX = (char & 15) << 4;
    var charPosY = (char >> 4) << 4;

    prog.setMat4('uData', [
        x-2, y-2,  (charPosX * texelX), (charPosY * texelY),
        x-2 + lx, y-2,  ((charPosX+15) * texelX), (charPosY * texelY),
        x-2 + lx, y + sizeY+1, ((charPosX + 15) * texelX), ((charPosY+15) * texelY),
        x-2,  y + sizeY+1,  (charPosX * texelX), ((charPosY+15) * texelY) ]);

    gl.drawElements(gl.TRIANGLES, indices.numItems, gl.UNSIGNED_SHORT, 0);
    

    for (var i = 0, li = text.length; i < li; i++) {
        char = text.charCodeAt(i) - 32;
        charPosX = (char & 15) << 4;
        charPosY = (char >> 4) << 4;

        switch(char) {
        case 12:
        case 14:
        case 27: //:
        case 28: //;
        case 64: //'
        case 73: //i
        case 76: //l
        case 84: //t

            prog.setMat4('uData', [
                x, y,  (charPosX * texelX), (charPosY * texelY),
                x + sizeX2, y,  ((charPosX+8) * texelX), (charPosY * texelY),
                x + sizeX2, y + sizeY, ((charPosX + 8) * texelX), ((charPosY+16) * texelY),
                x,  y + sizeY,  (charPosX * texelX), ((charPosY+16) * texelY) ]);

            x += sizeX2;
            break;

        default:

            prog.setMat4('uData', [
                x, y,  (charPosX * texelX), (charPosY * texelY),
                x + sizeX, y,  ((charPosX+15) * texelX), (charPosY * texelY),
                x + sizeX, y + sizeY, ((charPosX + 15) * texelX), ((charPosY+16) * texelY),
                x,  y + sizeY,  (charPosX * texelX), ((charPosY+16) * texelY) ]);

            x += sizeX;
                
            break;
        }

        gl.drawElements(gl.TRIANGLES, indices.numItems, gl.UNSIGNED_SHORT, 0);

    }

    if (useState !== true) {
        gl.enable(gl.CULL_FACE);
    
        if (depth == null) {
            gl.enable(gl.DEPTH_TEST);
        }
    }
};


RendererDraw.prototype.getTextSize = function(size, text) {
    var sizeX = size - 1;
    var sizeX2 = Math.round(size*0.5);
    var x = 0;

    for (var i = 0, li = text.length; i < li; i++) {
        var char = text.charCodeAt(i) - 32;

        switch(char) {
        case 12:
        case 14:
        case 27: //:
        case 28: //;7
        case 64: //'
        case 73: //i
        case 76: //l
        case 84: //t
            x += sizeX2;
            break;

        default:
            x += sizeX;
            break;
        }
    }
    
    return x;
};


RendererDraw.prototype.drawGpuJobs = function() {
    var gpu = this.gpu;
    var gl = this.gl;
    var renderer = this.renderer;

    renderer.geoRenderCounter++;

    //setup stencil
    gl.stencilMask(0xFF);
    gl.clear(gl.STENCIL_BUFFER_BIT);
    gl.stencilFunc(gl.EQUAL, 0, 0xFF);
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.INCR);

    var screenPixelSize = [1.0/renderer.curSize[0], 1.0/renderer.curSize[1]];
    var rmap = this.rmap;
    var clearPass = 513;
    var clearPassIndex = 0;
    var clearStencilPasses = renderer.clearStencilPasses;
    var jobZBuffer = renderer.jobZBuffer;
    var jobZBufferSize = renderer.jobZBufferSize;
    var jobZBuffer2 = renderer.jobZBuffer2;
    var jobZBuffer2Size = renderer.jobZBuffer2Size;
    var onlyHitLayers = renderer.onlyHitLayers;
    var onlyAdvancedHitLayers = renderer.onlyAdvancedHitLayers;
    var geoRenderCounter = renderer.geoRenderCounter;
    var job, key, hitmapRender = renderer.onlyHitLayers;

    if (clearStencilPasses.length > 0) {
        clearPass = clearStencilPasses[0];
        clearPassIndex++;
    }

    if (this.rmap.counter != this.renderer.geoRenderCounter) {
        this.rmap.clear();
    }

    renderer.gmapIndex = 0;

    var forceUpdate = false;

    renderer.jobHBuffer = {};

    var ret, frameTime = renderer.frameTime, sortHbuffer = false;

    //console.log("" + frameTime);

    //draw job buffer and also clean buffer
    for (var i = 0, li = jobZBuffer.length; i < li; i++) {
        var j, lj = jobZBufferSize[i], lj2 = jobZBuffer2Size[i];
        var buffer = jobZBuffer[i];
        var buffer2 = jobZBuffer2[i];

        if (lj > 0 && i >= clearPass) {
            gl.clear(gl.STENCIL_BUFFER_BIT);

            if (clearStencilPasses.length > clearPassIndex) {
                clearPass = clearStencilPasses[clearPassIndex];
                clearPassIndex++;
            } else {
                clearPass = 513;
            }
        }

        if (onlyHitLayers) {
            if (onlyAdvancedHitLayers) {
                for (j = 0; j < lj; j++) {
                    if (buffer[j].advancedHit) {
                        this.drawGpuJob(gpu, gl, renderer, buffer[j], screenPixelSize, true);
                    }
                }
            } else {
                for (j = 0; j < lj; j++) {
                    var job = buffer[j];
                    if (job.hitable) {
                        this.drawGpuJob(gpu, gl, renderer, job, screenPixelSize);
                        if (job.advancedHit) {
                            renderer.advancedPassNeeded = true;
                        }
                    }
                }
            }
        } else {

            for (j = 0; j < lj; j++) {
 
                job = buffer[j];
                this.drawGpuJob(gpu, gl, renderer, job, screenPixelSize);

                if (!hitmapRender && job.hysteresis && job.id) {
                    var job2 = buffer2[job.id];

                    if (!job2) {
                        job.timerShow = 0;
                        job.timerHide = 0;
                        job.draw = false;
                        buffer2[job.id] = job;
                        jobZBuffer2Size[i]++;
                        forceUpdate = true;
                    } else {
                        if (job.tile && job2.tile && job.tile.id[0] != job2.tile.id[0]) {
                        //if (job != job2) {

                            buffer2[job.id] = job;
                            job.timerShow = job2.timerShow;
                            job.timerHide = job2.timerHide;
                            job.draw = job2.draw;
                            //job.mv = job2.mv;
                            //job.mvp = job2.mvp;
                            job.renderCounter[0][0] = 0;
                            
                            if (job2.lastSubJob) {
                                job.lastSubJob = job2.lastSubJob.slice();
                                job.lastSubJob[0] = job;
                            }

                            job2.timerShow = 0;
                            job2.timerHide = 0;
                            job2.draw = false;
                        } 
                    }

                    //if (job.hysteresis[3] === true) {
                        sortHbuffer = true;
                    //}
                }
            }
        }

        if (renderer.gmapIndex > 0) {
            processGMap(gpu, gl, renderer, screenPixelSize);
            renderer.gmapIndex = 0;
        }

        if (rmap.rectanglesCount > 0) {
            rmap.processRectangles(gpu, gl, renderer, screenPixelSize);
        }

        lj2 = jobZBuffer2Size[i];

        if (lj2) {
            var hbuffer = renderer.jobHBuffer;

            for (key in buffer2) {
                job = hbuffer[key];

                if (!hitmapRender) {
                    if (job) {
                      
                        if (!job.draw) {
                            job.timerShow += frameTime;

                            if (job.timerShow > (job.hysteresis[0])) {
                                job.draw = true;
                                job.timerShow = 0;
                            } else {
                                forceUpdate = true;
                            }
                        } else if (job.timerHide) {
                            job.draw = false;
                            job.timerShow = (job.hysteresis[0]) * (1.0-(job.timerHide / (job.hysteresis[1])));
                        }

                        job.timerHide = 0;

                    } else {
                        job = buffer2[key];

                        if (job.draw) {
                            job.timerHide += frameTime;

                            if (job.timerHide > (job.hysteresis[1])) {
                                delete buffer2[key];
                                jobZBuffer2Size[i]--;
                                job.draw = false;
                                job.timerHide = 0;
                            } else {
                                forceUpdate = true;
                            }
                        } else if (job.timerShow) {
                            job.draw = true;
                            job.timerHide = (job.hysteresis[1]) * (1.0-(job.timerShow / (job.hysteresis[0])));
                        }

                        job.timerShow = 0;
                    }
                }

                var draw = job.draw, fade = null;

                if (!hitmapRender && job.hysteresis[3] === true) {
 
                    if (draw) {
                        if (job.timerHide != 0) {
                            fade = job.timerHide / (job.hysteresis[1]+1);
                            fade = 1.0 - Math.min(1.0, fade);
                        }
                    } else {
                        if (job.timerShow != 0) {
                            fade = job.timerShow / (job.hysteresis[0]+1);
                            fade = Math.min(1.0, fade);
                            draw = true;
                        }
                    }
                }


                if (draw) {
                    // update job matricies
                    if (job.renderCounter[0][0] !== geoRenderCounter && job.renderCounter[0][0] !== null) { 
                        var renderCounter = job.renderCounter[0];

                        var mvp = mat4.create();
                        var mv = mat4.create();
                        var group = renderCounter[3];
                        var bbox = group.bbox;
                        var geoPos = renderer.cameraPosition;
                    
                        var m = math.translationMatrix(bbox.min[0] - geoPos[0], bbox.min[1] - geoPos[1], bbox.min[2] - geoPos[2]);
                        mat4.multiply(renderer.camera.getModelviewMatrix(), m, mv);

                        var proj = renderer.camera.getProjectionMatrix();
                        mat4.multiply(proj, mv, mvp);

                        job.mv = mv;
                        job.mvp = mvp;
                    }                    

                    this.drawGpuSubJob(gpu, gl, renderer, screenPixelSize, job.lastSubJob, fade);
                }
            }
        }
    }

    if (forceUpdate) {
        this.core.markDirty();
    }

};


RendererDraw.prototype.clearJobBuffer = function() {
    var renderer = this.renderer;
    var jobZBuffer = renderer.jobZBuffer;
    var jobZBufferSize = renderer.jobZBufferSize;

    //clean job buffer
    for (var i = 0, li = jobZBuffer.length; i < li; i++) {
        var lj = jobZBufferSize[i];
        var buffer = jobZBuffer[i];

        for (var j = 0; j < lj; j++) {
            buffer[j] = null;
        }

        jobZBufferSize[i] = 0;
    }
};


RendererDraw.prototype.clearJobHBuffer = function() {
    var renderer = this.renderer;
    var jobZBuffer2 = renderer.jobZBuffer2;
    var jobZBuffer2Size = renderer.jobZBuffer2Size;

    //clean job hbuffer
    for (var i = 0, li = jobZBuffer2.length; i < li; i++) {
        jobZBuffer2[i] = {};
        jobZBuffer2Size[i] = 0;
    }
};


RendererDraw.prototype.paintGL = function() {
    var renderer = this.renderer;

    this.gpu.clear(true, false);

    if (!renderer.onlyLayers) {
        if (!renderer.onlyDepth && !renderer.onlyHitLayers) {
            this.drawSkydome();
        }
    }
};


RendererDraw.prototype.drawGpuJob = function(gpu, gl, renderer, job, screenPixelSize, advancedHitPass, ignoreFilters) {
    if (!job.ready) {
        return;
    }

    //if (!(job.tile.id[0] == 14 && job.tile.id[1] == 4383 && job.tile.id[2] == 2863)) {
      //  return;
    //}

    var state = job.state & 0xff;
    var id = job.eventInfo['#id'];

    if (id != null) {

        if (job.state & (2 << 8)) { //has selection layers?

            if (renderer.geodataSelection.indexOf(id) != -1) {  // is selected

                if (job.state & (3 << 8)) { //has hover layers?

                    if (renderer.hoverFeature && renderer.hoverFeature[0]['#id'] == id) {
                        if (state != 3) {
                            return;
                        }
                    } else {
                        if (state != 2) {
                            return;
                        }
                    }
                }
            } else if (job.state & (1 << 8)) { //has hover layers?

                if (renderer.hoverFeature && renderer.hoverFeature[0]['#id'] == id) {
                    if (state != 1) {
                        return;
                    }
                } else {
                    if (state != 0) {
                        return;
                    }
                }

            } else {
                if (state != 0) {
                    return;
                }        
            }
        
        } else if (job.state & (1 << 8)) { //has hover layers?

            if (renderer.hoverFeature && renderer.hoverFeature[0]['#id'] == id) {
                if (state != 1) {
                    return;
                }
            } else {
                if (state != 0) {
                    return;
                }
            }

        } else {
            if (state != 0) {
                return;;
            }        
        }

    } else {
        if (state != 0) {
            return;
        }        
    }

    var mvp = job.mvp, prog, texture;
    var vertexPositionAttribute, vertexTexcoordAttribute,
        vertexNormalAttribute, vertexOriginAttribute, vertexElementAttribute;

    var hitmapRender = job.hitable && renderer.onlyHitLayers;
    var screenPixelSize2, color = job.color;

    if (hitmapRender) {
        var c = renderer.hoverFeatureCounter;
        //color = [(c&255)/255, ((c>>8)&255)/255, ((c>>16)&255)/255, 1];
        color = [(c&255)/255, ((c>>8)&255)/255, 0, 0];
        renderer.hoverFeatureList[c] = [job.eventInfo, job.center, job.clickEvent, job.hoverEvent, job.enterEvent, job.leaveEvent, advancedHitPass];
        renderer.hoverFeatureCounter++;
    }

    switch(job.type) {
    case VTS_JOB_FLAT_LINE:
        gpu.setState(hitmapRender ? renderer.stencilLineHitState : renderer.stencilLineState);

        var debugWires = (gpu === 0); //just generate false value to avoid compiler warnings;

        prog = advancedHitPass ? job.program2 : debugWires ? renderer.progLineWireframe : job.program;
        gpu.useProgram(prog, advancedHitPass ? ['aPosition', 'aElement'] : debugWires ? ['aPosition', 'aBarycentric'] : ['aPosition']);

        prog.setVec4('uColor', color);
        prog.setMat4('uMVP', mvp, renderer.getZoffsetFactor(job.zbufferOffset));

        vertexPositionAttribute = prog.getAttribute('aPosition');

        //bind vetex positions
        gl.bindBuffer(gl.ARRAY_BUFFER, job.vertexPositionBuffer);
        gl.vertexAttribPointer(vertexPositionAttribute, job.vertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

        if (advancedHitPass) {
            vertexElementAttribute = prog.getAttribute('aElement');
            gl.bindBuffer(gl.ARRAY_BUFFER, job.vertexElementBuffer);
            gl.vertexAttribPointer(vertexElementAttribute, job.vertexElementBuffer.itemSize, gl.FLOAT, false, 0, 0);
        }

        if (debugWires) {
            var barycentericAttribute = prog.getAttribute('aBarycentric');
            gl.bindBuffer(gl.ARRAY_BUFFER, gpu.barycentricBuffer);
            gl.vertexAttribPointer(barycentericAttribute, gpu.barycentricBuffer.itemSize, gl.FLOAT, false, 0, 0);
        }
        
        //draw polygons
        gl.drawArrays(gl.TRIANGLES, 0, job.vertexPositionBuffer.numItems);

        break;

    case VTS_JOB_FLAT_RLINE:
    case VTS_JOB_FLAT_TLINE:
    case VTS_JOB_PIXEL_LINE:
    case VTS_JOB_PIXEL_TLINE:
        gpu.setState(hitmapRender ? renderer.stencilLineHitState : renderer.stencilLineState);
            
        prog = advancedHitPass ? job.program2 : job.program;
        texture = null;
        var textureParams = [0,0,0,0];
        screenPixelSize2 = screenPixelSize;

        if (hitmapRender) {
            if (job.type == VTS_JOB_PIXEL_TLINE) {
                if (job.widthByRatio) {
                    screenPixelSize2 = [ screenPixelSize[0] * renderer.curSize[1], screenPixelSize[1] * renderer.curSize[1]];
                }
                prog = advancedHitPass ? this.renderer.progELine3 : this.renderer.progLine3;
                if (!prog.isReady()) {
                    return;
                }
            }
        }

        if (job.type != VTS_JOB_PIXEL_LINE) {

            if (job.type == VTS_JOB_FLAT_RLINE) {
                textureParams = [0, 0, 0, job.widthByRatio ? renderer.cameraViewExtent : 1];
            } else {
                if (hitmapRender) {
                    texture = renderer.whiteTexture;

                    if (job.type == VTS_JOB_FLAT_TLINE || job.type == VTS_JOB_FLAT_RLINE) {
                        textureParams = [0, 0, 0, job.widthByRatio ? renderer.cameraViewExtent : 1];
                    }

                } else {
                    var t = job.texture;
                    if (t == null || t[0] == null) {
                        return;
                    }

                    texture = t[0];
                    textureParams = [0, t[1]/t[0].height, (t[1]+t[2])/t[0].height, job.widthByRatio ? renderer.cameraViewExtent : 1];

                    if (job.type == VTS_JOB_FLAT_TLINE || job.type == VTS_JOB_FLAT_RLINE) {
                        if (job.widthByRatio) {
                            textureParams[0] = 1/(renderer.cameraViewExtent2*job.lineWidth)/(texture.width/t[2]);
                        } else {
                            textureParams[0] = 1/job.lineWidth/(texture.width/t[2]);    
                        }
                    } else {
                        if (job.widthByRatio) {
                            textureParams[0] = 1/(renderer.cameraViewExtent2/renderer.curSize[1])/(texture.width/t[2]);
                            textureParams[0] /= (renderer.curSize[1]*job.lineWidth*0.5);
                            //textureParams[3] = renderer.curSize[1]*(1.0/job.lineWidth)*0.5;
                            textureParams[3] = renderer.curSize[1];
                        } else {
                            textureParams[0] = 1/(renderer.cameraViewExtent2/renderer.curSize[1])/(texture.width/t[2]);
                            textureParams[0] /= (job.lineWidth*0.5);
                            textureParams[3] = 1;
                        }    
                    }
                }

                if (!texture.loaded) {
                    return;
                }

                gpu.bindTexture(texture);
            }

        } else if (job.widthByRatio) {
            screenPixelSize2 = [ screenPixelSize[0] * renderer.curSize[1], screenPixelSize[1] * renderer.curSize[1]];
        }

        gpu.useProgram(prog, advancedHitPass ? ['aPosition','aNormal','aElement'] : ['aPosition','aNormal']);

        prog.setVec4('uColor', color);
        prog.setVec2('uScale', screenPixelSize2);
        prog.setMat4('uMVP', mvp, renderer.getZoffsetFactor(job.zbufferOffset));

        if (job.type != VTS_JOB_PIXEL_LINE) {
            if (job.background != null) {
                prog.setVec4('uColor2', hitmapRender ? [0,0,0,0] : job.background);
            }
            prog.setVec4('uParams', textureParams);
            prog.setSampler('uSampler', 0);
        }

        vertexPositionAttribute = prog.getAttribute('aPosition');
        vertexNormalAttribute = prog.getAttribute('aNormal');

        //bind vetex positions
        gl.bindBuffer(gl.ARRAY_BUFFER, job.vertexPositionBuffer);
        gl.vertexAttribPointer(vertexPositionAttribute, job.vertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

        //bind vetex normals
        gl.bindBuffer(gl.ARRAY_BUFFER, job.vertexNormalBuffer);
        gl.vertexAttribPointer(vertexNormalAttribute, job.vertexNormalBuffer.itemSize, gl.FLOAT, false, 0, 0);

        if (advancedHitPass) {
            vertexElementAttribute = prog.getAttribute('aElement');
            gl.bindBuffer(gl.ARRAY_BUFFER, job.vertexElementBuffer);
            gl.vertexAttribPointer(vertexElementAttribute, job.vertexElementBuffer.itemSize, gl.FLOAT, false, 0, 0);
        }

        //draw polygons
        gl.drawArrays(gl.TRIANGLES, 0, job.vertexPositionBuffer.numItems);

        break;

    case VTS_JOB_LINE_LABEL:
        gpu.setState(hitmapRender ? renderer.lineLabelHitState : renderer.lineLabelState);

        var files = job.files;

        if (files.length > 0) {
            for (var i = 0, li = files.length; i < li; i++) {
                if (files[i].length > 0) {
                    var font = job.fonts[i];
                    if (font && !font.areTexturesReady(files[i])) {
                        return;
                    }
                }
            }

        } else {
            if (!hitmapRender) {
                return;
            }

            texture = renderer.whiteTexture;
        }

        prog = job.program; //renderer.progText;

        gpu.useProgram(prog, ['aPosition', 'aTexCoord']);
        prog.setSampler('uSampler', 0);
        prog.setMat4('uMVP', mvp, renderer.getZoffsetFactor(job.zbufferOffset));
        prog.setVec4('uVec', renderer.labelVector);

        var gamma = job.outline[2] * 1.4142 / 20;
        var gamma2 = job.outline[3] * 1.4142 / 20;
        prog.setVec4('uColor', (hitmapRender ? color : job.color2));
        prog.setVec2('uParams', [job.outline[0], gamma2]);

        vertexPositionAttribute = prog.getAttribute('aPosition');
        vertexTexcoordAttribute = prog.getAttribute('aTexCoord');

        //bind vetex positions
        gl.bindBuffer(gl.ARRAY_BUFFER, job.vertexPositionBuffer);
        gl.vertexAttribPointer(vertexPositionAttribute, job.vertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

        //bind vetex texcoords
        gl.bindBuffer(gl.ARRAY_BUFFER, job.vertexTexcoordBuffer);
        gl.vertexAttribPointer(vertexTexcoordAttribute, job.vertexTexcoordBuffer.itemSize, gl.FLOAT, false, 0, 0);

        //draw polygons
        for(var j = 0; j < (hitmapRender ? 1 : 2); j++) {
            if (j == 1) {
                prog.setVec4('uColor', color);
                prog.setVec2('uParams', [job.outline[1], gamma]);
            }

            if (files.length > 0) {
                for (var i = 0, li = files.length; i < li; i++) {
                    var fontFiles = files[i];

                    for (var k = 0, lk = fontFiles.length; k < lk; k++) {
                        var file = fontFiles[k];
                        prog.setFloat('uFile', Math.round(file+i*1000));
                        gpu.bindTexture(job.fonts[i].getTexture(file));
                        gl.drawArrays(gl.TRIANGLES, 0, job.vertexPositionBuffer.numItems);
                    }
                }

            } else {
                gpu.bindTexture(texture);
                gl.drawArrays(gl.TRIANGLES, 0, job.vertexPositionBuffer.numItems);
            }
        }

        break;

    case VTS_JOB_ICON:
    case VTS_JOB_LABEL:


        if (job.reduce && job.reduce[0] != 7) {
            var a;

            if (job.reduce[0] > 4) {
                
                if (job.reduce[0] == 4) {
                    a = Math.max(job.reduce[1], Math.floor(job.reduce[2] / Math.max(1, renderer.drawnGeodataTiles)));

                    if (job.index >= a) {
                        return;
                    } 
                } else {
                    a = Math.pow(job.texelSize * job.tiltAngle, VTS_TILE_COUNT_FACTOR); 
                    a = Math.max(job.reduce[1], Math.round(job.reduce[2] * (a / Math.max(0.00001, this.renderer.drawnGeodataTilesFactor))));

                    if (job.index >= a) {
                        return;
                    } 
                }

            } else {
                a = job.tiltAngle;

                if (job.reduce[0] == 1) {
                    a = 1.0 - (Math.acos(a) * (1.0/(Math.PI*0.5)));
                } else if (job.reduce[0] == 3) {
                    a = (Math.cos(Math.acos(a) * 2) + 1.0) * 0.5;
                }

                var indexLimit = (Math.round(job.reduce[1] + (a*job.reduce[2]))-1);

                if (job.index > indexLimit) {
                    return;
                } 
            }
        }

        var files = job.files;

        if (files.length > 0) {
            for (var i = 0, li = files.length; i < li; i++) {
                if (files[i].length > 0) {
                    var font = job.fonts[i];
                    if (font && !font.areTexturesReady(files[i])) {
                        return;
                    }
                }
            }

        } else {
            texture = hitmapRender ? renderer.whiteTexture : job.texture;
            if (!texture.loaded) {
                return;
            }
        }

        var p1, p2, camVec, ll, l = null;

        if (job.culling != 180) {
            p2 = job.center;
            p1 = renderer.cameraPosition;
            camVec = [p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]];

            if (job.visibility) {
                l = vec3.length(camVec);

                switch(job.visibility.length) {
                    case 1:
                        if (l > job.visibility[0]) {
                            return;
                        }
                        break;

                    case 2:
                        ll = l * renderer.localViewExtentFactor;
                        if (ll < job.visibility[0] || ll > job.visibility[1]) {
                            return;
                        }

                        break;

                    case 4:
                        ll = l * renderer.localViewExtentFactor;

                        var diameter = job.visibility[0] * job.visibility[1];

                        //dinfo = [l, ll, diameter, (job.visibility[2] * ll), (job.visibility[3] * ll)];

                        if (diameter < (job.visibility[2] * ll) || diameter > (job.visibility[3] * ll)) {
                            return;
                        }

                        break;
                }

                l = 1/l;
                camVec[0] *= l;                       
                camVec[1] *= l;                       
                camVec[2] *= l;                       
            } else {
                vec3.normalize(camVec);
            }
                
            job.normal = [0,0,0];
            vec3.normalize(job.center, job.normal);
                
            var a = -vec3.dot(camVec, job.normal);
            if (a < Math.cos(math.radians(job.culling))) {
                return;
            }
        } else if (job.visibility) {

            p2 = job.center;
            p1 = renderer.cameraPosition;
            camVec = [p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]];
            l = vec3.length(camVec);

            switch(job.visibility.length) {
                case 1:
                    if (l > job.visibility[0]) {
                        return;
                    }
                    break;

                case 2:
                    l *= renderer.localViewExtentFactor;
                    if (l < job.visibility[0] || l > job.visibility[1]) {
                        return;
                    }

                    break;

                case 4:
                    l *= renderer.localViewExtentFactor;

                    var diameter = job.visibility[0] * job.visibility[1];
                    if (diameter < (job.visibility[2] * l) || diameter > (job.visibility[3] * l)) {
                        return;
                    }

                    break;
            }
        }

        var s = job.stick;
        var stickShift = 0, pp, o, depth;

        if (s[0] != 0) {
            stickShift = renderer.cameraTiltFator * s[0];
                
            if (stickShift < s[1]) {
                stickShift = 0;
            } else if (s[2] != 0) {
                pp = renderer.project2(job.center, renderer.camera.mvp, renderer.cameraPosition);
                pp[0] = Math.round(pp[0]);
                pp[1] -= stickShift;
            }
        }

        if (job.noOverlap) { 
            if (!pp) {
                pp = renderer.project2(job.center, renderer.camera.mvp, renderer.cameraPosition);
            }

            o = job.noOverlap, depth = pp[2];

            if (depth < 0 || depth > 1.0) {
                return;
            }

            if (o[4] !== null) {
                if (o[4] === VTS_NO_OVERLAP_DIRECT) {
                    depth = o[5];
                } else {
                    if (l === null) {
                        p2 = job.center;
                        p1 = renderer.cameraPosition;
                        camVec = [p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]];
                        l = vec3.length(camVec) + 0.0001;
                    }

                    depth = o[5]/l;
                } 
            }

            job.lastSubJob = [job, stickShift, texture, files, color, pp, true, depth, o];

            if (job.reduce && job.reduce[0] == 7) {
                renderer.gmap[renderer.gmapIndex] = job.lastSubJob;
                renderer.gmapIndex++;
                return;
            }

            if (!renderer.rmap.addRectangle(pp[0]+o[0], pp[1]+o[1], pp[0]+o[2], pp[1]+o[3], depth, job.lastSubJob)) {
                renderer.rmap.storeRemovedRectangle(pp[0]+o[0], pp[1]+o[1], pp[0]+o[2], pp[1]+o[3], depth, job.lastSubJob);
                return;
            }

            return; //draw all labe from same z-index together
        } else {
            if (job.reduce && job.reduce[0] == 7) {
                if (!pp) {
                    pp = renderer.project2(job.center, renderer.camera.mvp, renderer.cameraPosition);
                }

                job.lastSubJob = [job, stickShift, texture, files, color, pp, false];

                renderer.gmap[renderer.gmapIndex] = job.lastSubJob;
                renderer.gmapIndex++;
                return;
            }
        }

        if (job.hysteresis && job.id) {
            if (!pp) {
                pp = renderer.project2(job.center, renderer.camera.mvp, renderer.cameraPosition);
            }

            job.lastSubJob = [job, stickShift, texture, files, color, pp];
            renderer.jobHBuffer[job.id] = job;
            return;
        }

        if (renderer.drawLabelBoxes) {
            o = job.noOverlap;

            if (o) {
                if (!pp) {
                    pp = renderer.project2(job.center, renderer.camera.mvp, renderer.cameraPosition);
                }

                gpu.setState(hitmapRender ? renderer.lineLabelHitState : renderer.lineLabelState);
                this.drawLineString([[pp[0]+o[0], pp[1]+o[1], 0.5], [pp[0]+o[2], pp[1]+o[1], 0.5],
                                     [pp[0]+o[2], pp[1]+o[3], 0.5], [pp[0]+o[0], pp[1]+o[3], 0.5], [pp[0]+o[0], pp[1]+o[1], 0.5]], true, 1, [255, 0, 0, 255], null, true, null, null, null);
            }
        }

        gpu.setState(hitmapRender ? renderer.lineLabelHitState : renderer.labelState);

        if (s[0] != 0 && s[2] != 0) {
            if (!pp) {
                pp = renderer.project2(job.center, renderer.camera.mvp, renderer.cameraPosition);
            }

            this.drawLineString([[pp[0], pp[1]+stickShift, pp[2]], [pp[0], pp[1], pp[2]]], true, s[2], [s[3], s[4], s[5], s[6]], null, null, null, null, true);
        }

        /*if (dinfo) { //debug only
            if (!pp) {
                pp = renderer.project2(job.center, renderer.camera.mvp, renderer.cameraPosition);
            }

            var stmp = "" + dinfo[0].toFixed(0) + " " + dinfo[1].toFixed(0) + " " + dinfo[2].toFixed(0) + " " + dinfo[3].toFixed(0) + " " + dinfo[4].toFixed(0);
            this.drawText(Math.round(pp[0]-this.getTextSize(10,stmp)*0.5), Math.round(pp[1]), 10, stmp, [1,1,1,1], 0);
        }*/

        prog = job.program; //renderer.progIcon;

        gpu.useProgram(prog, ['aPosition', 'aTexCoord', 'aOrigin']);
        prog.setSampler('uSampler', 0);
        prog.setMat4('uMVP', mvp, renderer.getZoffsetFactor(job.zbufferOffset));
        prog.setVec4('uScale', [screenPixelSize[0], screenPixelSize[1], (job.type == VTS_JOB_LABEL ? 1.0 : 1.0 / texture.width), stickShift*2]);

        var j = 0, lj = 1, gamma = 0, gamma2 = 0;

        if (prog != renderer.progIcon) {
            gamma = job.outline[2] * 1.4142 / job.size;
            gamma2 = job.outline[3] * 1.4142 / job.size;
            prog.setVec4('uColor', hitmapRender ? color : job.color2);
            prog.setVec2('uParams', [job.outline[0], gamma2]);
            lj = hitmapRender ? 1 : 2;
        } else {
            prog.setVec4('uColor', color);
        }

        vertexPositionAttribute = prog.getAttribute('aPosition');
        vertexTexcoordAttribute = prog.getAttribute('aTexCoord');
        vertexOriginAttribute = prog.getAttribute('aOrigin');

        //bind vetex positions
        gl.bindBuffer(gl.ARRAY_BUFFER, job.vertexPositionBuffer);
        gl.vertexAttribPointer(vertexPositionAttribute, job.vertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

        //bind vetex texcoordds
        gl.bindBuffer(gl.ARRAY_BUFFER, job.vertexTexcoordBuffer);
        gl.vertexAttribPointer(vertexTexcoordAttribute, job.vertexTexcoordBuffer.itemSize, gl.FLOAT, false, 0, 0);

        //bind vetex origin
        gl.bindBuffer(gl.ARRAY_BUFFER, job.vertexOriginBuffer);
        gl.vertexAttribPointer(vertexOriginAttribute, job.vertexOriginBuffer.itemSize, gl.FLOAT, false, 0, 0);

        //draw polygons
        for(;j<lj;j++) {
            if (j == 1) {
                prog.setVec4('uColor', color);
                prog.setVec2('uParams', [job.outline[1], gamma]);
            }

            if (files.length > 0) {
                for (var i = 0, li = files.length; i < li; i++) {
                    var fontFiles = files[i];

                    for (var k = 0, lk = fontFiles.length; k < lk; k++) {
                        var file = fontFiles[k];
                        prog.setFloat('uFile', Math.round(file+i*1000));
                        gpu.bindTexture(job.fonts[i].getTexture(file));
                        gl.drawArrays(gl.TRIANGLES, 0, job.vertexPositionBuffer.numItems);
                    }
                }

            } else {
                gpu.bindTexture(texture);
                gl.drawArrays(gl.TRIANGLES, 0, job.vertexPositionBuffer.numItems);
            }
        }

        break;
    }

    return;
};

RendererDraw.prototype.drawGpuSubJob = function(gpu, gl, renderer, screenPixelSize, subjob, fade) {
    if (!subjob) {
        return;
    }

    var job = subjob[0], stickShift = subjob[1], texture = subjob[2],
        files = subjob[3], color = subjob[4], pp = subjob[5], s = job.stick,
        o = job.noOverlap;

    if (job.hysteresis && job.id) {
        if (job.culling != 180) {
            var p2 = job.center;
            var p1 = renderer.cameraPosition;
            var camVec = [p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]];
            vec3.normalize(camVec);
                
            job.normal = [0,0,0];
            vec3.normalize(job.center, job.normal);
                
            var a = -vec3.dot(camVec, job.normal);
            if (a < Math.cos(math.radians(job.culling))) {
                return;
            }
        }

        if (o) {
            var x1 = pp[0]+o[0], y1 = pp[1]+o[1], 
                x2 = pp[0]+o[2], y2 = pp[1]+o[3]+stickShift;

            if (s[0] != 0) {
                stickShift = renderer.cameraTiltFator * s[0];
                    
                if (stickShift < s[1]) {
                    stickShift = 0;
                }
            }

            /* 
            var rmap = renderer.rmap;

            //screen including credits
            if (x1 < 0 || x2 > rmap.slx || y1 < 0 || y2 > rmap.sly) {
                return false;
            }

            //compass
            if (x1 < rmap.clx && x2 > 0 && y1 <= rmap.sly && y2 > (rmap.sly - rmap.cly)) {
                return false;
            }

            //serach bar
            if (x1 < rmap.blx && x2 > 0 && y1 <= rmap.bly && y2 > 0) {
                return false;
            }*/
        }

        if (s[0] != 0) {
            stickShift = renderer.cameraTiltFator * s[0];
                
            if (stickShift < s[1]) {
                stickShift = 0;
            } else if (s[2] != 0) {
                pp = renderer.project2(job.center, renderer.camera.mvp, renderer.cameraPosition);
                pp[0] = Math.round(pp[0]);
                pp[1] -= stickShift;
            }
        }

    }

    var hitmapRender = job.hitable && renderer.onlyHitLayers;

    if (renderer.drawLabelBoxes && o) {
        gpu.setState(hitmapRender ? renderer.lineLabelHitState : renderer.lineLabelState);
        this.drawLineString([[pp[0]+o[0], pp[1]+o[1], 0.5], [pp[0]+o[2], pp[1]+o[1], 0.5],
                             [pp[0]+o[2], pp[1]+o[3], 0.5], [pp[0]+o[0], pp[1]+o[3], 0.5], [pp[0]+o[0], pp[1]+o[1], 0.5]], true, 1, [255, 0, 0, 255], null, true, null, null, null);
    }

    gpu.setState(hitmapRender ? renderer.lineLabelHitState : renderer.labelState);

    var j = 0, lj = 1, gamma = 0, gamma2 = 0, color2 = job.color2;

    if (fade !== null) {
        color = [color[0], color[1], color[2], color[3] * fade];

        if (color2) {
            color2 = [color2[0], color2[1], color2[2], color2[3] * fade];
        }
    }

    if (s[0] != 0 && s[2] != 0) {
        this.drawLineString([[pp[0], pp[1]+stickShift, pp[2]], [pp[0], pp[1], pp[2]]], true, s[2], [s[3], s[4], s[5], ((fade !== null) ? s[6] * fade : s[6]) ], null, null, null, null, true);
    }

    var prog = job.program; //renderer.progIcon;

    gpu.useProgram(prog, ['aPosition', 'aTexCoord', 'aOrigin']);
    prog.setSampler('uSampler', 0);
    prog.setMat4('uMVP', job.mvp, renderer.getZoffsetFactor(job.zbufferOffset));
    prog.setVec4('uScale', [screenPixelSize[0], screenPixelSize[1], (job.type == VTS_JOB_LABEL ? 1.0 : 1.0 / texture.width), stickShift*2]);

    if (prog != renderer.progIcon) {
        gamma = job.outline[2] * 1.4142 / job.size;
        gamma2 = job.outline[3] * 1.4142 / job.size;
        prog.setVec4('uColor', hitmapRender ? color : color2);
        prog.setVec2('uParams', [job.outline[0], gamma2]);
        lj = hitmapRender ? 1 : 2;
    } else {
        prog.setVec4('uColor', color);
    }

    var vertexPositionAttribute = prog.getAttribute('aPosition');
    var vertexTexcoordAttribute = prog.getAttribute('aTexCoord');
    var vertexOriginAttribute = prog.getAttribute('aOrigin');

    //bind vetex positions
    gl.bindBuffer(gl.ARRAY_BUFFER, job.vertexPositionBuffer);
    gl.vertexAttribPointer(vertexPositionAttribute, job.vertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

    //bind vetex texcoordds
    gl.bindBuffer(gl.ARRAY_BUFFER, job.vertexTexcoordBuffer);
    gl.vertexAttribPointer(vertexTexcoordAttribute, job.vertexTexcoordBuffer.itemSize, gl.FLOAT, false, 0, 0);

    //bind vetex origin
    gl.bindBuffer(gl.ARRAY_BUFFER, job.vertexOriginBuffer);
    gl.vertexAttribPointer(vertexOriginAttribute, job.vertexOriginBuffer.itemSize, gl.FLOAT, false, 0, 0);

    //draw polygons
    for(;j<lj;j++) {
        if (j == 1) {
            prog.setVec4('uColor', color);
            prog.setVec2('uParams', [job.outline[1], gamma]);
        }

        if (files.length > 0) {
            for (var i = 0, li = files.length; i < li; i++) {
                var fontFiles = files[i];

                for (var k = 0, lk = fontFiles.length; k < lk; k++) {
                    var file = fontFiles[k];
                    prog.setFloat('uFile', Math.round(file+i*1000));
                    gpu.bindTexture(job.fonts[i].getTexture(file));
                    gl.drawArrays(gl.TRIANGLES, 0, job.vertexPositionBuffer.numItems);
                }
            }

        } else {
            gpu.bindTexture(texture);
            gl.drawArrays(gl.TRIANGLES, 0, job.vertexPositionBuffer.numItems);
        }
    }
};

export default RendererDraw;
