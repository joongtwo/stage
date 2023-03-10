// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/*global
 define
 */

/**
 *
 * @module js/epEffectivitySlider
 */
import effectivitySliderHandler from 'js/epEffectivitySliderHandler';



let exports = {};
let MAX_EFFECTIVITY_UNIT = 888888;

let svgns = 'http://www.w3.org/2000/svg';

let EffectivitySlider = function( configuration ) {
    this.effectivityRange = configuration.range;
    this.container = configuration.container;
    this.object = configuration.object;
    this.leftSliderHandler = null;
    this.rightSliderHandler = null;
    this.minUnit = configuration.minUnit;
};

export let setEffectivitySliderConfiguration = function( configuration ) {
    return new EffectivitySlider( configuration );
};

EffectivitySlider.prototype.drawUnitEffectivitySliders = function() {
    let sliderContainer = this.container;
    let leftSliderElement = createSliderElement();
    sliderContainer.appendChild( leftSliderElement );

    let sliderHandlerConfiguration = {};
    sliderHandlerConfiguration.sliderElement = leftSliderElement;
    sliderHandlerConfiguration.container = sliderContainer.parentNode;
    sliderHandlerConfiguration.isLeftSlider = true;
    sliderHandlerConfiguration.minUnit = this.minUnit;
    sliderHandlerConfiguration.objectId = this.object.uid;
    sliderHandlerConfiguration.isUp = false;
    this.leftSliderHandler = effectivitySliderHandler.setEffectivitySliderHandlerConfiguration( sliderHandlerConfiguration );
    this.leftSliderHandler.createSliderEventListners();

    // For right sliders
    let rightSliderElement = createSliderElement();
    sliderContainer.appendChild( rightSliderElement );

    sliderHandlerConfiguration.sliderElement = rightSliderElement;
    sliderHandlerConfiguration.container = sliderContainer.parentNode;
    sliderHandlerConfiguration.isLeftSlider = false;
    sliderHandlerConfiguration.minUnit = this.minUnit;
    sliderHandlerConfiguration.objectId = this.object.uid;

    if( this.effectivityRange.end === MAX_EFFECTIVITY_UNIT ) {
        rightSliderElement.style.display = 'none';
        sliderHandlerConfiguration.isUp = true;
    } else {
        sliderHandlerConfiguration.isUp = false;
    }
    this.rightSliderHandler = effectivitySliderHandler.setEffectivitySliderHandlerConfiguration( sliderHandlerConfiguration );
    this.rightSliderHandler.createSliderEventListners();

    this.leftSliderHandler.setRefSilderElement( this.rightSliderHandler );
    this.rightSliderHandler.setRefSilderElement( this.leftSliderHandler );

    // NEED TO CHANGE(Use rect as a refernce position of slider)  USE getBoundingClientRect
    let leftPosition =  ( this.effectivityRange.start - 1 ) * 20;
    this.leftSliderHandler.setPosition( leftPosition );

    let rightPosition =   this.effectivityRange.end  * 20;
    this.rightSliderHandler.setPosition( rightPosition );
};

let createSliderElement = function() {
    let sliderSvg = createSliderSVGElement( 10, 60 );
    let topOuterCircleSvg = createOuterCircleSVGElement( 4, 4, 4 );
    let topInnerCircleSvg = createInnerCircleSVGElement( 4, 4, 3 );
    let rectSvg = createRectSVGElement( 3.5, 1, 60 );
    let bottomOuterCircleSvg = createOuterCircleSVGElement( 4, 56, 4 );
    let bottomInnerCircleSvg = createInnerCircleSVGElement( 4, 56, 3 );
    sliderSvg.appendChild( rectSvg );
    sliderSvg.appendChild( topOuterCircleSvg );
    sliderSvg.appendChild( topInnerCircleSvg );
    sliderSvg.appendChild( bottomOuterCircleSvg );
    sliderSvg.appendChild( bottomInnerCircleSvg );
    return sliderSvg;
};

let createSliderSVGElement = function( width, height ) {
    let sliderSvg = document.createElementNS( svgns, 'svg' );
    sliderSvg.setAttributeNS( null, 'class', 'aw-epValidateEffectivity-wiEffectivitySlider' );
    sliderSvg.setAttributeNS( null, 'width', width );
    sliderSvg.setAttributeNS( null, 'height', height );
    return sliderSvg;
};

let createCircleSVGElement = function( cx, cy, r ) {
    let circleSvg = document.createElementNS( svgns, 'circle' );
    circleSvg.setAttributeNS( null, 'cx', cx );
    circleSvg.setAttributeNS( null, 'cy', cy );
    circleSvg.setAttributeNS( null, 'r', r );
    return circleSvg;
};

let createOuterCircleSVGElement = function( cx, cy, r ) {
    let circleSvg = createCircleSVGElement( cx, cy, r );
    circleSvg.setAttributeNS( null, 'class', 'aw-epValidateEffectivity-wiEffectivitySliderCircleOuter' );
    return circleSvg;
};

let createInnerCircleSVGElement = function( cx, cy, r ) {
    let circleSvg = createCircleSVGElement( cx, cy, r );
    circleSvg.setAttributeNS( null, 'class', 'aw-epValidateEffectivity-wiEffectivitySliderCircleInner' );
    return circleSvg;
};

let createRectSVGElement = function( x, width, height ) {
    let rectSvg = document.createElementNS( svgns, 'rect' );
    rectSvg.setAttributeNS( null, 'class', 'aw-epValidateEffectivity-wiEffectivitySlideRect' );
    rectSvg.setAttributeNS( null, 'style', 'z-index: -1' );
    rectSvg.setAttributeNS( null, 'x', x );
    rectSvg.setAttributeNS( null, 'width', width );
    rectSvg.setAttributeNS( null, 'height', height );
    return rectSvg;
};

EffectivitySlider.prototype.getSliderRange = function() {
    let end = this.rightSliderHandler.unit;
    if( this.rightSliderHandler.isUp ) {
        end = MAX_EFFECTIVITY_UNIT;
    }
    return {
        start: this.leftSliderHandler.unit,
        end: end
    };
};

EffectivitySlider.prototype.removeSliders = function() {
    this.leftSliderHandler.removeSilderElement();
    this.rightSliderHandler.removeSilderElement();
};

EffectivitySlider.prototype.isUnitPresent = function( unit ) {
    let range = this.getSliderRange();
    return  unit >= range.start && unit <= range.end;
};

export default exports = {
    setEffectivitySliderConfiguration
};
