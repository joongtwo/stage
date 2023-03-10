// Copyright (c) 2022 Siemens

/**
 * @module js/epEffectivitySliderHandler
 */
import appCtxService from 'js/appCtxService';
import { constants as epEffectivityConstants } from 'js/epEffectivityConstants';
import epEffectivityContainer from 'js/epEffectivityContainer';

let STATUS_CHECK = 'checked';
let MAX_EFFECTIVITY_UNIT_FOR_DISPLAY = 75;

let EffectivitySliderHandler = function( configuration ) {
    this.sliderElement = configuration.sliderElement;
    this.container = configuration.container;
    this.objectId = configuration.objectId;
    this.isLeft = configuration.isLeftSlider;
    this.isUp = configuration.isUp;
    this.refSilderElement = null;
    this.active = false;
    this.currentX = 0;
    this.currentY = 0;
    this.initialX = 0;
    this.initialY = 0;
    this.xOffset = 0;
    this.yOffset = 0;
    this.position = 0;

    if( this.isUp ) {
        this.unit = MAX_EFFECTIVITY_UNIT_FOR_DISPLAY;
    } else {
        this.unit = 0;
    }

    this.deleted = false;

    if( configuration.minUnit !== null ) {
        this.gap = configuration.minUnit - 1;
    } else {
        this.gap = 0;
    }
};

function setEffectivitySliderHandlerConfiguration( configuration ) {
    return new EffectivitySliderHandler( configuration );
}

EffectivitySliderHandler.prototype.createSliderEventListners = function() {
    if( this.isUp === true ) {
        return;
    }
    this.container.addEventListener( 'touchstart', this.dragStart.bind( this ) );
    this.container.addEventListener( 'touchend', this.dragEnd.bind( this ) );
    this.container.addEventListener( 'touchmove', this.drag.bind( this ) );

    this.container.addEventListener( 'mousedown', this.dragStart.bind( this ) );
    this.container.addEventListener( 'mouseup', this.dragEnd.bind( this ) );
    this.container.addEventListener( 'mousemove', this.drag.bind( this ), false );
};

EffectivitySliderHandler.prototype.removeEventListeners = function() {
    this.container.removeEventListener( 'touchstart', this.dragStart.bind( this ) );
    this.container.removeEventListener( 'touchend', this.dragEnd.bind( this ) );
    this.container.removeEventListener( 'touchmove', this.drag.bind( this ) );

    this.container.removeEventListener( 'mousedown', this.dragStart.bind( this ) );
    this.container.removeEventListener( 'mouseup', this.dragEnd.bind( this ) );
    this.container.removeEventListener( 'mousemove', this.drag.bind( this ), false );
};

EffectivitySliderHandler.prototype.setRefSilderElement = function( refSilderElement ) {
    this.refSilderElement = refSilderElement;
};

EffectivitySliderHandler.prototype.dragStart = function( e ) {
    if( this.isThisSliderElement( e.target ) ) {
        if( e.type === 'touchstart' ) {
            this.initialX = e.touches[ 0 ].clientX - this.xOffset;
            this.initialY = e.touches[ 0 ].clientY - this.yOffset;
        } else {
            this.initialX = e.clientX - this.xOffset;
            this.initialY = e.clientY - this.yOffset;
        }
        this.active = true;
    }
};

EffectivitySliderHandler.prototype.isThisSliderElement = function( target ) {
    return target === this.sliderElement || target.parentNode === this.sliderElement;
};

EffectivitySliderHandler.prototype.dragEnd = function( e ) {
    if( this.active ) {
        this.initialX = this.currentX;
        this.initialY = this.currentY;
        this.active = false;
    }
};

EffectivitySliderHandler.prototype.drag = function( e ) {
    if( this.active && !this.deleted ) {
        e.preventDefault();

        if( e.type === 'touchmove' ) {
            this.currentX = e.touches[ 0 ].clientX - this.initialX;
            this.currentY = e.touches[ 0 ].clientY - this.initialY;
        } else {
            this.currentX = e.clientX - this.initialX;
            this.currentY = e.clientY - this.initialY;
        }

        this.xOffset = this.currentX;
        this.yOffset = this.currentY;

        this.currentX -=  this.currentX % 20;

        setTranslate( this.currentX, 0, this.sliderElement );

        let parentPos = this.sliderElement.parentElement.getBoundingClientRect().left;
        let elmPos = this.sliderElement.getBoundingClientRect().left;
        let pos = elmPos - parentPos;

        pos = Math.round( pos );

        if( parseInt( pos / 20 ) === parseInt( this.position / 20 ) ) {
            return;
        }
        this.position = pos;

        let unit = parseInt( this.position / 20 ) + this.gap;

        let refUnitPos = this.getRefUnitPosition();

        if( this.isLeft ) {
            this.updateStatus( unit + 1 );
        } else {
            this.updateStatus( unit );
        }

        let toBeRemoved = this.checkForRangeRemoval();
        if( toBeRemoved ) {
            this.unit = -1;
            this.refSilderElement.unit = -1;
        }
        epEffectivityContainer.objectSliderDragEvent( this.objectId );
    }
};

let setTranslate = function( xPos, yPos, el ) {
    el.style.transform = 'translate3d(' + xPos + 'px, ' + yPos + 'px, 0)';
};

EffectivitySliderHandler.prototype.getRefUnitPosition = function() {
    return this.refSilderElement.unit;
};

EffectivitySliderHandler.prototype.removeSilderElement = function() {
    this.deleted = true;
    this.refSilderElement.deleted = true;
    this.sliderElement.remove();
};

EffectivitySliderHandler.prototype.updateStatus = function( newUnit ) {
    if( newUnit < 1 ) {
        return;
    }
    if( this.isLeft ) {
        let start = this.unit;
        if( newUnit < start ) {
            start = newUnit;
        }

        this.unit = newUnit;

        for( let i = start; i <= this.refSilderElement.unit; ++i ) {
            let rectElm = document.getElementById( this.objectId + '-' +  i.toString() );
            if( i >= newUnit ) {
                rectElm.setAttribute( STATUS_CHECK, true );
            } else {
                rectElm.setAttribute( STATUS_CHECK, false );
            }
        }
        this.unit = newUnit;
    } else {
        let end = this.unit;
        if( newUnit > end ) {
            end = newUnit;
        }

        this.unit = newUnit;

        for( let i = this.refSilderElement.unit; i <= end; ++i ) {
            let rectEle = document.getElementById( this.objectId + '-' +  i.toString() );
            if( i <= newUnit ) {
                rectEle.setAttribute( STATUS_CHECK, true );
            } else {
                rectEle.setAttribute( STATUS_CHECK, false );
            }
        }
        this.unit = newUnit;
    }
    epEffectivityContainer.updateDirtyFlagOfRowObject( this.objectId, true );
    appCtxService.updatePartialCtx( epEffectivityConstants.EP_EFFECTIVITY_IS_DIRTY, true );
};

EffectivitySliderHandler.prototype.setPosition = function( pos ) {
    if( this.isUp ) {
        return;
    }

    this.position = pos - 20 *  this.gap;

    this.sliderElement.style.left = this.position.toString() + 'px';

    let unit = parseInt( this.position / 20 );

    if( this.isLeft ) {
        this.unit = unit + 1 + this.gap;
    } else {
        this.unit = unit + this.gap;
    }
};

EffectivitySliderHandler.prototype.getPosition = function() {
    return this.sliderElement.getBoundingClientRect().left;
};

EffectivitySliderHandler.prototype.checkForRangeRemoval = function() {
    let currentSliderElmPos = this.getPosition();
    let refSliderElmPos = this.refSilderElement.getPosition();

    let removeRange = false;
    if( this.isLeft ) {
        removeRange = currentSliderElmPos >= refSliderElmPos;
    } else {
        removeRange = currentSliderElmPos <= refSliderElmPos;
    }
    return removeRange;
};

const exports = {
    setEffectivitySliderHandlerConfiguration
};
export default exports;
