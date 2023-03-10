// Copyright (c) 2022 Siemens

/**
 * @module js/epEffectivityRow
 */
import appCtxService from 'js/appCtxService';
import effectivityTemplateRow from 'js/epEffectivityTemplateRow';
import effectivitySliders from 'js/epEffectivitySlider';
import localeService from  'js/localeService';
import { constants as epEffectivityConstants } from 'js/epEffectivityConstants';
import epEffectivityContainer from 'js/epEffectivityContainer';

let STATUS_CHECK = 'checked';

let MAX_EFFECTIVITY_UNIT;

let defaultUnitClass;
let unitWithEffectivityClass;
let instrMessagePath = '/i18n/InstructionsEffectivityMessages';
let UP = 'UP';
let RANGE = 'range';
let UNIT = 'unit';
let DIV = 'div';
let CLASS = 'class';
let IS_UP = 'isUP';
let TRUE = 'true';
let FALSE = 'false';
let BLOCK = 'block';
let NONE = 'none';
let WI_EFFECTIVITY_SLIDER_DIV = 'aw-epValidateEffectivity-wiEffectivitySliderDiv';
let UP_CHECKBOX_DEFAULT = 'aw-epInstructionsEffectivity-upCheckboxDefault';
let UP_CHECKBOX_SET = 'aw-epInstructionsEffectivity-upCheckboxSet';
let WI_EFFECTIVITY_TOOLTIP = 'wiEffectivityToolTip';
let BLANK_UNITS = 'aw-epValidateEffectivity-blankUnit';
let PX = 'px';
let CENTER = 'center';
let UID = 'uid';

let ObjectEffectivity = function( configuration ) {
    this.object = configuration.object;
    this.layout = configuration.layout;
    this.operationNameElement = configuration.operationNameElement;
    this.operationUpCheckboxElement = configuration.operationUpCheckboxElement;
    this.maxUnit = configuration.maxUnit;
    this.minUnit = configuration.minUnit;
    this.effectivityRanges = configuration.effectivityRanges;
    this.effectivityObj = configuration.effectivityObj;
    this.isUP = configuration.isUP;
    this.objectSvg = null;
    this.svgsContainer = null;
    this.sliderContainer = null;
    this.sliders = [];
    this.effectivityString = null;
    this.InheritedFrom = configuration.InheritedFrom;
    this.IsAligned = configuration.IsAligned;
};

function createObjectEffectivity( configuration ) {
    return new ObjectEffectivity( configuration );
}

ObjectEffectivity.prototype.drawUnitEffectivityRow = function( validateEffectivityData, configData ) {
    if( !this.layout ) {
        return;
    }
    defaultUnitClass = configData.defaultUnit;
    unitWithEffectivityClass = configData.unitWithEffectivity;
    MAX_EFFECTIVITY_UNIT = validateEffectivityData.upRangeMaxVal;
    // Creating row for selected object
    let rowObjectDiv = effectivityTemplateRow.createEffectivityRowTemplate( this.object, this.layout, this.operationNameElement, configData );
    this.objectSvg = rowObjectDiv.svg;
    this.svgsContainer = rowObjectDiv.container;

    if( !this.object ) {
        for( let i = this.minUnit; i <= this.maxUnit; ++i ) {
            let id =  i.toString();
            effectivityTemplateRow.createAndAddRect( this.objectSvg, null, id, false, BLANK_UNITS );
        }
    } else{
        // creating units in object row
        for( let i = this.minUnit; i <= this.maxUnit; ++i ) {
            let id =  i.toString();
            effectivityTemplateRow.createAndAddRect( this.objectSvg, this.object.uid, id, false, defaultUnitClass, this.showToolTip, this.hideToolTip, this.onUnitClick.bind( this ) );
        }
        effectivityTemplateRow.createAndAddUpCheckbox( this.operationUpCheckboxElement, this.object.uid, UP, this.isUP, this.onUpClick.bind( this ) );

        // update status of units in object row
        this.updateObjectUnitsStatus( this.minUnit, this.maxUnit );

        // Displaying unit ranges of object

        if( this.effectivityRanges && this.sliderContainer === null ) {
            this.sliderContainer = document.createElement( DIV );
            this.sliderContainer.setAttribute( CLASS, WI_EFFECTIVITY_SLIDER_DIV );
            this.svgsContainer.appendChild( this.sliderContainer );
            this.sliderContainer.style.display = NONE;
        }

        for( let j = 0; j < this.effectivityRanges.length; ++j ) {
            this.displayObjectUnitRanges( this.effectivityRanges[ j ] );
        }

        this.mergeRanges();
    }
};

ObjectEffectivity.prototype.setTooltipString = function() {
    this.effectivityString = '';
    for( let j = 0; j < this.effectivityRanges.length; ++j ) {
        this.effectivityString += this.effectivityRanges[ j ].start.toString();
        if( this.effectivityRanges[ j ].end === MAX_EFFECTIVITY_UNIT ) {
            this.effectivityString += '-' + UP;
        } else if( this.effectivityRanges[ j ].start === this.effectivityRanges[ j ].end ) {
            //for single unit
        } else {
            this.effectivityString += '-' + this.effectivityRanges[ j ].end.toString();
        }

        if( j !== this.effectivityRanges.length - 1 ) {
            this.effectivityString += ', ';
        }
    }
    if( this.svgsContainer ) {
        this.svgsContainer.setAttribute( RANGE, this.effectivityString );
    }
};

ObjectEffectivity.prototype.updateObjectUnitsStatus = function( startUnit, unitEffectivityLength ) {
    for( let i = startUnit; i <= unitEffectivityLength; ++i ) {
        let rectElm = document.getElementById( this.object.uid + '-' + i.toString() );

        if( rectElm !== null ) {
            let checked = rectElm.getAttribute( STATUS_CHECK );
            if( checked === TRUE ) {
                rectElm.setAttributeNS( null, 'class', unitWithEffectivityClass );
            } else {
                rectElm.setAttributeNS( null, 'class', defaultUnitClass );
            }
        }
    }
};

ObjectEffectivity.prototype.displayObjectUnitRanges = function( effectivityRange ) {
    let effectivityEndRange = effectivityRange.end === MAX_EFFECTIVITY_UNIT ? this.maxUnit : effectivityRange.end;
    for( let k = effectivityRange.start; k <= effectivityEndRange; ++k ) {
        let rectEle = document.getElementById( this.object.uid + '-' + k.toString() );
        rectEle.setAttributeNS( null, 'class', unitWithEffectivityClass );
        rectEle.setAttribute( STATUS_CHECK, true );
    }

    //Adding sliders
    let sliderConfiguration = {};
    sliderConfiguration.range = effectivityRange;
    sliderConfiguration.container = this.sliderContainer;
    sliderConfiguration.object = this.object;
    sliderConfiguration.minUnit = this.minUnit;
    let effectivitySlider = effectivitySliders.setEffectivitySliderConfiguration( sliderConfiguration );
    effectivitySlider.drawUnitEffectivitySliders();
    this.sliders.push( effectivitySlider );

    this.sliderContainer.parentElement.addEventListener( 'mouseover', this.onMouseOver.bind( this ) );
    this.sliderContainer.parentElement.addEventListener( 'mouseout', this.onMouseOut.bind( this ) );
};

// on mouseover
ObjectEffectivity.prototype.onMouseOver = function( event ) {
    // Sliders are visible only when UP checkbox uncheked.
    if( this.isUP === false && this.sliderContainer.style.display === NONE ) {
        this.sliderContainer.style.display = BLOCK;
    }
};

// on mouseout
ObjectEffectivity.prototype.onMouseOut = function( event ) {
    // Sliders are visible only when UP checkbox uncheked.
    if( this.isUP === false && this.sliderContainer.style.display === BLOCK ) {
        this.sliderContainer.style.display = NONE;
    }
};

// On click event listner
ObjectEffectivity.prototype.onUnitClick = function( event ) {
    // User can click only when UP checkbox uncheked.
    if( this.isUP ) {
        return;
    }

    let rectElm = event.target;
    let unitId = rectElm.getAttribute( UNIT );
    let unit = parseInt( unitId );
    let checked = rectElm.getAttribute( STATUS_CHECK );
    if( checked === TRUE ) {
        rectElm.setAttribute( STATUS_CHECK, false );
        this.addAndRemoveObjectSliders( unit );
    } else {
        rectElm.setAttribute( STATUS_CHECK, true );
        this.addSlider( unit, unit );
    }
    this.objectSliderEventHandler();
    this.updateObjectUnitsStatus( unit, unit );
    epEffectivityContainer.summaryRowUpdate();
    epEffectivityContainer.updateDirtyFlagOfRowObject( this.object.uid, true );
    appCtxService.updatePartialCtx( epEffectivityConstants.EP_EFFECTIVITY_IS_DIRTY, true );
};

// on up click
ObjectEffectivity.prototype.onUpClick = function( event ) {
    let upCheckbox = event.target;
    if( upCheckbox !== null ) {
        let isUp = upCheckbox.getAttribute( IS_UP );
        if( isUp === TRUE ) {
            upCheckbox.setAttribute( IS_UP, FALSE );
            upCheckbox.setAttribute( CLASS, UP_CHECKBOX_DEFAULT );
            upCheckbox.innerHTML = '';
            this.removeEffectivityUp();
            this.isUP = false;
        } else {
            upCheckbox.setAttribute( IS_UP, TRUE );
            upCheckbox.setAttribute( CLASS, UP_CHECKBOX_SET );
            upCheckbox.innerHTML = UP;
            this.setEffectivityUp();
            this.isUP = true;
        }
    }
    epEffectivityContainer.summaryRowUpdate();
    epEffectivityContainer.updateDirtyFlagOfRowObject( this.object.uid, true );
    appCtxService.updatePartialCtx( epEffectivityConstants.EP_EFFECTIVITY_IS_DIRTY, true );
};

// Add and remove sliders when single unit is selected
ObjectEffectivity.prototype.addAndRemoveObjectSliders = function( unit ) {
    let newSlider = null;
    for( let i = 0; i < this.sliders.length; ++i ) {
        if( this.sliders[ i ].isUnitPresent( unit ) ) {
            newSlider = this.sliders[ i ];
            break;
        }
    }
    if( newSlider !== null ) {
        let sliderRange = newSlider.getSliderRange();
        this.addSlider( sliderRange.start, unit - 1 );
        this.addSlider( unit + 1, sliderRange.end );
        this.removeSlider( newSlider );
    }
};

ObjectEffectivity.prototype.addSlider = function( start, end ) {
    if( start <= end ) {
        let newEffectivityRange = {
            start: start,
            end: end
        };
        this.displayObjectUnitRanges( newEffectivityRange );
    }
};

ObjectEffectivity.prototype.removeSlider = function( slider ) {
    slider.removeSliders();
    let sliderIndex = this.sliders.indexOf( slider );
    if( sliderIndex > -1 ) {
        this.sliders.splice( sliderIndex, 1 );
    }
};

ObjectEffectivity.prototype.setEffectivityUp = function() {
    let lastRange = this.effectivityRanges[ this.effectivityRanges.length - 1 ];
    for( let j = 0; j < this.sliders.length; ++j ) {
        let range = this.sliders[ j ].getSliderRange();
        if( lastRange.start === range.start ) {
            this.removeSlider( this.sliders[ j ] );
            this.addSlider( range.start, MAX_EFFECTIVITY_UNIT );
        }
    }
    this.mergeRanges();
};

ObjectEffectivity.prototype.removeEffectivityUp = function() {
    for( let j = 0; j < this.sliders.length; ++j ) {
        let range = this.sliders[ j ].getSliderRange();
        if( range.end === MAX_EFFECTIVITY_UNIT ) {
            this.removeSlider( this.sliders[ j ] );
            this.addSlider( range.start, this.maxUnit );
        }
    }

    this.mergeRanges();
};

ObjectEffectivity.prototype.updateRanges = function() {
    this.effectivityRanges = [];

    for( let j = 0; j < this.sliders.length; ++j ) {
        let range = this.sliders[ j ].getSliderRange();

        //Check if range is valid
        if( range.start !== -1 || range.end !== -1 ) {
            this.effectivityRanges.push( range );
        }
    }

    this.effectivityRanges.sort( function( a, b ) {
        if( a.start < b.start ) {
            return -1;
        }
        return 1;
    } );
};

// Remove invalid ranges and sliders e.g. start=-1, end=-1
ObjectEffectivity.prototype.removeInvalidRanges = function() {
    let sliderToBeRemoved = null;
    for( let i = 0; i < this.sliders.length; ++i ) {
        let range = this.sliders[ i ].getSliderRange();

        //Check if range is valid
        if( range.start === -1 || range.end === -1 ) {
            sliderToBeRemoved = this.sliders[ i ];
        }
    }
    if( sliderToBeRemoved !== null ) {
        this.removeSlider( sliderToBeRemoved );
    }

    this.updateObjectUnitsStatus( this.minUnit, this.maxUnit );
    this.updateRanges();
    this.setTooltipString();
};

// merge of ranges and sliders
ObjectEffectivity.prototype.mergeRanges = function() {
    let continueMerge = false;
    let startSlider = null;
    let endSlider = null;
    let startSliderRange = null;
    let endSliderRange = null;
    for( let i = 0; i < this.sliders.length; ++i ) {
        let sliderRange1 = this.sliders[ i ].getSliderRange();

        let breakLoop = false;
        for( let j = i + 1; j < this.sliders.length; ++j ) {
            let sliderRange2 = this.sliders[ j ].getSliderRange();
            if( sliderRange2.start - sliderRange1.end === 1 ) {
                startSlider = this.sliders[ i ];
                endSlider = this.sliders[ j ];
                startSliderRange = sliderRange1;
                endSliderRange = sliderRange2;
                breakLoop = true;
                break;
            } else if( sliderRange1.start - sliderRange2.end === 1 ) {
                startSlider = this.sliders[ i ];
                endSlider = this.sliders[ j ];
                startSliderRange = sliderRange2;
                endSliderRange = sliderRange1;
                breakLoop = true;
                break;
            }
        }

        if( breakLoop ) {
            break;
        }
    }
    if( startSlider !== null && endSlider !== null && startSlider !== endSlider ) {
        this.removeSlider( startSlider );
        this.removeSlider( endSlider );
        this.addSlider( startSliderRange.start, endSliderRange.end );
        continueMerge = true;
    }

    this.updateObjectUnitsStatus( this.minUnit, this.maxUnit );
    this.updateRanges();
    this.setTooltipString();

    if( continueMerge ) {
        this.mergeRanges();
    }
};

// Handle all cases when slider is moved or new slider is added.
ObjectEffectivity.prototype.objectSliderEventHandler = function() {
    this.mergeRanges();
    this.removeInvalidRanges();
};

ObjectEffectivity.prototype.showToolTip = function( event ) {
    let resource = localeService.getLoadedText( instrMessagePath );

    let toolTip = document.getElementById( WI_EFFECTIVITY_TOOLTIP );
    let rectElement = event.target;
    let toolTipPosition = rectElement.getBoundingClientRect();
    if( toolTip ) {
        toolTip.style.left =  toolTipPosition.left - 20  + PX;
        toolTip.style.top =  toolTipPosition.top - 58 + PX;
        toolTip.style.display = BLOCK;
        toolTip.style.align = CENTER;

        let checked = rectElement.getAttribute( STATUS_CHECK );
        if( checked === TRUE ) {
            let objectUid = rectElement.getAttribute( UID );

            let rowContainerElement = document.getElementById( objectUid );
            let range = rowContainerElement.getAttribute( RANGE );
            toolTip.innerHTML = resource.unitTooltip.format( rectElement.getAttribute( 'unit' ) ) + ' |  ' +
                resource.effectivityRangeTooltip.format( range );
        } else {
            toolTip.innerHTML = resource.unitTooltip.format( rectElement.getAttribute( UNIT ) );
        }
    }
};

ObjectEffectivity.prototype.hideToolTip = function( event ) {
    let toolTip = document.getElementById( WI_EFFECTIVITY_TOOLTIP );
    if( toolTip ) {
        toolTip.style.display = NONE;
    }
};
const exports = {
    createObjectEffectivity
};

export default exports;

