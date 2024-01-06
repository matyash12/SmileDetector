<script setup>
import * as tf from '@tensorflow/tfjs';
import { ref, onMounted } from 'vue';
import * as mediapipe from '@mediapipe/tasks-vision';


const showTakeImage = ref(true);
const showFindFace = ref(true);
const showCropFace = ref(true);
const showResizeFace = ref(true);
const showPrediction = ref(true);
const showTestData = ref(false);
const showDebug = ref(false);
const predictionText = ref("Nothing is predicted");

const logAlot = ref(false);

const errorHappened = ref(false);
//await wait(1000) = wait one second
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

//Starts video feed in "videoElement"
//The videoElement will be populated
async function createVideoFeed(videoElement) {

    navigator.mediaDevices.getUserMedia({ video: true })
        .then(function (stream) {
            videoElement.srcObject = stream;
        })
        .catch(function (error) {
            console.error('Error accessing webcam:', error);
        });

    function isVideoInitialized(videoElement) {
        return videoElement.srcObject !== null && videoElement.srcObject !== undefined;
    }
    while (isVideoInitialized(videoElement) == false) {
        await wait(1000); //keep some reserve. If done too quickly it creates black image???? dont know how...
    }
}

//populates "imgElement" with image
async function takeImage(videoElement, imgElement) {


    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;

    const context = canvas.getContext('2d');
    context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

    const imageDataURL = canvas.toDataURL('image/png');
    imgElement.src = imageDataURL;


}


//TODO replace with my own ml
async function getFaceDetector() {
    const vision = await mediapipe.FilesetResolver.forVisionTasks(
        // path/to/wasm/root
        //TODO add local source
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );
    const facedetector = await mediapipe.FaceDetector.createFromOptions(
        vision,
        {
            baseOptions: {
                modelAssetPath: "/blaze_face_short_range.tflite"
            },
            runningMode: "IMAGE"
        });
    return facedetector;
}


//Returns box coordinates for face
//TODO add multiple faces
//TODO add no face support
//TODO disable logs :)
async function getFaceBoxCoordinates(faceDetector, imgElement) {
    const faceDetectorResult = faceDetector.detect(imgElement);
    let box = faceDetectorResult.detections[0].boundingBox;
    return box;
}



//crop image
function cropImage(sourceImageElement, targetImageElement, startX, startY, endX, endY) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Set the canvas size to the crop size
    const cropWidth = endX - startX;
    const cropHeight = endY - startY;
    canvas.width = cropWidth;
    canvas.height = cropHeight;

    // Draw the cropped portion of the source image onto the canvas
    ctx.drawImage(sourceImageElement, startX, startY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

    // Create a new image with the cropped data
    const croppedImage = new Image();
    croppedImage.src = canvas.toDataURL('image/jpg');

    // Replace the target image with the cropped image
    targetImageElement.src = croppedImage.src;
}


function resizeImages(sourceImg, targetImg, targetWidth, targetHeight) {
    // Create a new image element
    const croppedImage = new Image();

    // Set up the onload event handler to ensure the image is loaded before resizing
    croppedImage.onload = function () {
        // Create a canvas element
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Set canvas dimensions to target width and height
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        // Draw the source image on the canvas
        ctx.drawImage(croppedImage, 0, 0, targetWidth, targetHeight);

        // Update the target image source with the resized image data
        targetImg.src = canvas.toDataURL('image/jpg');
    };

    // Set the source of the new image element
    croppedImage.src = sourceImg.src;
}



async function getModel() {
    const model = await tf.loadLayersModel('/model.json');
    return model;
}

function preprocessImage(image) {
    const processedImg = tf.expandDims(image);
    return processedImg;
}
function makePrediction(model, image) {

    const predictions = model.predict(image);
    if (logAlot.value == true) {
        predictions.print();
    }

    const classIndex = tf.argMax(predictions.flatten()).dataSync()[0];
    return classIndex;
    //const className = class_names[classIndex];
}

function getClassName(classIndex, class_names) {
    const className = class_names[classIndex];
    return className;
}

function createBoxWithText(sourceImageElement, targetImageElement, startX, startY, endX, endY, boxColor = 'red', boxThickness = 2, text = '') {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Set the canvas size to the original image size
    canvas.width = sourceImageElement.width;
    canvas.height = sourceImageElement.height;

    // Draw the original image onto the canvas
    ctx.drawImage(sourceImageElement, 0, 0);

    // Draw a box around the specified region
    ctx.strokeStyle = boxColor;
    ctx.lineWidth = boxThickness;
    ctx.strokeRect(startX, startY, endX - startX, endY - startY);

    // Add text under the box
    ctx.font = '14px Arial';
    ctx.fillStyle = boxColor;
    ctx.fillText(text, startX, endY + 18);

    // Create a new image with the box and text drawn
    const imageWithBoxAndText = new Image();
    imageWithBoxAndText.src = canvas.toDataURL('image/jpg');

    // Replace the target image with the new image
    targetImageElement.src = imageWithBoxAndText.src;
}




async function run() {
    const videoElement = document.getElementById('videotakeImage');
    const imgElement = document.getElementById("takeImage");
    const croppedImgElemenet = document.getElementById("croppedFace");
    const resizedCroppedFaceElement = document.getElementById("resizedCroppedFace")
    const model = await getModel();
    const class_names = ['non_smile', 'smile'];

    const mainImage = document.getElementById("mainImage");


    //static test data
    const static_non_smiling_image = document.getElementById("static_non_smiling_image");
    const static_smiling_image = document.getElementById("static_smiling_image");

    //jpg png test
    const static_non_smiling_image_2 = document.getElementById("static_non_smiling_image_2");//png
    const static_non_smiling_image_3 = document.getElementById("static_non_smiling_image_3");//jpg

    const faceDetector = await getFaceDetector();

    await createVideoFeed(videoElement);

    while (true) {
        await takeImage(videoElement, imgElement);


        try {

            let box = await getFaceBoxCoordinates(faceDetector, imgElement);
            //croppedImgElemenet.src = imgElement.src; //copy the image 

            cropImage(imgElement, croppedImgElemenet, box.originX + 5, box.originY, (box.originX) + (box.width - 10), box.originY + box.height - 10);


            resizeImages(croppedImgElemenet, resizedCroppedFaceElement, 32, 32);

            const img = tf.browser.fromPixels(resizedCroppedFaceElement);
            //const img = tf.browser.fromPixels(static_non_smiling_image_3);
            const preprocessedImage = preprocessImage(img);
            const classIndex = makePrediction(model, preprocessedImage);
            const className = getClassName(classIndex, class_names);


            predictionText.value = "You are: " + className;

            var text_shown_under_face = "Nothing really";

            if (classIndex == 0) {
                //non_smile
                text_shown_under_face = "Usmějte se prosím"
            }
            if (classIndex == 1) {
                //smile
                text_shown_under_face = "Nádherný úsměv"
            }
            createBoxWithText(imgElement, mainImage, box.originX, box.originY, box.originX + box.width, box.originY + box.height, "red", 2, text_shown_under_face)
            errorHappened.value =false;
        }
        catch (error) {
            errorHappened.value = true;
        }
        await wait(15) //TODO add something like wait for new image from camera...
    }

}
onMounted(() => {
    run();
});
</script>

<template>
    <div class="m-4">
        <div>
            <h1 class="title">Detekce úsměvu</h1>
            <img id="mainImage">
            <div>
                <label class="checkbox">
                    <input v-model="showDebug" type="checkbox">
                    Debug mode
                </label>
            </div>
        </div>

        <div v-show="showDebug">

            <div v-show="showTakeImage">
                <h1 class="title">Take image</h1>
                <p>Live video feed</p>
                <video width="400" height="300" autoplay id="videotakeImage"></video>
                <p>Image taken</p>
                <img id="takeImage">
            </div>
            <div v-show="showFindFace">
                <h1 class="title">Find face</h1>
            </div>
            <div v-show="showCropFace">
                <h1 class="title">Crop face</h1>
                <img id="croppedFace">
            </div>
            <div v-show="showResizeFace">
                <h1 class="title">Resize face image</h1>
                <img height="32" width="32" id="resizedCroppedFace">
            </div>
            <div v-show="showPrediction">
                <h1 class="title">Prediction</h1>
                <p>{{ predictionText }}</p>
            </div>
            <div v-show="showTestData">
                <h1>Test data</h1>
                <img id="static_non_smiling_image" src="/Adrian_Nastase_0002.jpg">
                <img id="static_non_smiling_image_2" src="/download.png">
                <img id="static_non_smiling_image_3" src="/download.jpg">
                <img id="static_smiling_image" src="/Zhang_Ziyi_0002.jpg">

            </div>
        </div>
    </div>
</template>