// Copyright (c) 2022 Siemens

/**
 * @module js/epEffectivitySummaryRow
 */
import _ from 'lodash';
import effectivityTemplateRow from 'js/epEffectivityTemplateRow';
import localeService from 'js/localeService';

const STATUS_CHECK = 'checked';
const instrMessagePath = '/i18n/InstructionsEffectivityMessages';

let unitWithGapClass;
let unitWithOverlapClass;
let unitWithEffectivityClass;
let unitWithMissingGapClass;
let unitWithMissingClass;

const unitWithGap = 0;
const unitWithEffectivity = 1;
const unitWithMissingGap = 'missingGap';
const unitWithMissing = 'missing';

let SummaryEffectivity = function( configuration ) {
    this.object = configuration.object;
    this.selectedObjects = configuration.selectedObjects;
    this.layout = configuration.layout;
    this.summaryNameElement = configuration.summaryNameElement;
    this.summaryUpCheckboxElement = configuration.summaryUpCheckboxElement;
    this.minUnit = configuration.minUnit;
    this.maxUnit = configuration.maxUnit;
    this.summarySvg = null;
    this.svgsContainer = null;
    this.summaryUnitList = null;
    this.isUP = configuration.isUP;
};

function createSummaryEffectivity( configuration ) {
    return new SummaryEffectivity( configuration );
}

SummaryEffectivity.prototype.drawSummaryRow = function( validateEffectivityData, configData ) {
    if( !this.layout ) {
        return;
    }
    // Creating row for summary

    unitWithGapClass = configData.unitWithGap;
    unitWithOverlapClass = configData.unitWithOverlap;
    unitWithEffectivityClass = configData.unitWithEffectivity;
    unitWithMissingGapClass = configData.unitWithMissingGap;
    unitWithMissingClass = configData.unitWithMissing;

    let summaryRow = effectivityTemplateRow.createEffectivityRowTemplate( this.object, this.layout, this.summaryNameElement );
    this.summarySvg = summaryRow.svg;
    this.svgsContainer = summaryRow.container;

    // creating units in summary row
    for( let i = this.minUnit; i <= this.maxUnit; ++i ) {
        if( validateEffectivityData && validateEffectivityData.effectiveUnits ) {
            if( validateEffectivityData.effectiveUnits.indexOf( i ) > -1 ) {
                let id = i.toString(); //add
                effectivityTemplateRow.createAndAddRect( this.summarySvg, this.object.name, id, true, unitWithEffectivityClass, this.showToolTip.bind( this ), this.hideToolTip );
            } else {
                let id = i.toString(); //add
                effectivityTemplateRow.createAndAddRect( this.summarySvg, this.object.name, id, false, unitWithEffectivityClass, this.showToolTip.bind( this ), this.hideToolTip );
            }
        } else {
            let id = i.toString(); //add
            effectivityTemplateRow.createAndAddRect( this.summarySvg, this.object.name, id, true, unitWithEffectivityClass, this.showToolTip.bind( this ), this.hideToolTip );
        }
    }
    effectivityTemplateRow.createAndAddUpCheckbox( this.summaryUpCheckboxElement, this.object.name, 'UP', this.isUP );

    // Creating summary unit status list.
    this.createSummaryUnitsStatusList();
};

// This can be shifted to another calculation.js
// e.g : SummaryUnitsStatusList = [0,1,0,2,4,0,1,...]
SummaryEffectivity.prototype.createSummaryUnitsStatusList = function() {
    let self = this;
    this.summaryUnitList = new Array( this.maxUnit ).fill( [] );
    if( this.selectedObjects ) {
        _.forEach( this.selectedObjects, function( object ) {
            for( let j = self.minUnit; j <= self.maxUnit; ++j ) {
                let rectElm = document.getElementById( object.uid + '-' + j.toString() );
                // Creating row for summary
                let summaryRectElm = document.getElementById( self.object.name + '-' + j.toString() );

                let checked = rectElm.getAttribute( STATUS_CHECK );
                let summaryRectChecked;
                if( summaryRectElm ) {
                    summaryRectChecked = summaryRectElm.getAttribute( STATUS_CHECK );
                }

                if( summaryRectChecked === 'false' && checked === 'true' ) {
                    self.summaryUnitList[ j - 1 ] = [ unitWithMissing ];
                } else if( summaryRectChecked === 'false' && checked === 'false' ) {
                    if( self.summaryUnitList[ j - 1 ].length === 0 || !self.summaryUnitList[ j - 1 ] === 'missing' ) {
                        self.summaryUnitList[ j - 1 ] = [ unitWithMissingGap ];
                    }
                } else if( checked === 'true' ) {
                    if( self.summaryUnitList[ j - 1 ].length === 0 ) {
                        self.summaryUnitList[ j - 1 ] = [ object.props.object_string.dbValues[ 0 ] ];
                    } else {
                        self.summaryUnitList[ j - 1 ].push( object.props.object_string.dbValues[ 0 ] );
                    }
                }
            }
        } );
    } else {
        for( let j = self.minUnit; j <= self.maxUnit; ++j ) {
            // Creating row for summary
            let summaryRectElm = document.getElementById( self.object.name + '-' + j.toString() );
            let summaryRectChecked;
            if( summaryRectElm ) {
                summaryRectChecked = summaryRectElm.getAttribute( STATUS_CHECK );
            }

            if( summaryRectChecked === 'false' ) {
                self.summaryUnitList[ j - 1 ] = [ unitWithMissingGap ];
            }
        }
    }

    // update status of units in summary row
    this.updateSummaryUnitsStatus();
};

SummaryEffectivity.prototype.updateSummaryUnitsStatus = function() {
    for( let k = this.minUnit - 1; k < this.maxUnit; ++k ) {
        let rectEleClass = null;
        let rectEle = document.getElementById( this.object.name + '-' + ( k + 1 ).toString() );
        if( this.summaryUnitList[ k ][ 0 ] === unitWithMissingGap ) {
            rectEleClass = unitWithMissingGapClass;
        } else if( this.summaryUnitList[ k ][ 0 ] === unitWithMissing ) {
            rectEleClass = unitWithMissingClass;
        } else if( this.summaryUnitList[ k ].length === unitWithGap ) {
            rectEleClass = unitWithGapClass;
        } else if( this.summaryUnitList[ k ].length === unitWithEffectivity ) {
            rectEleClass = unitWithEffectivityClass;
        } else {
            rectEleClass = unitWithOverlapClass;
        }
        rectEle.setAttributeNS( null, 'class', rectEleClass );
    }

    let upCheckbox = document.getElementById( this.object.name + '-UP' );
    if( upCheckbox !== null ) {
        if( this.isUP ) {
            upCheckbox.setAttribute( 'class', 'aw-epInstructionsEffectivity-upCheckboxSet' );
        } else {
            upCheckbox.setAttribute( 'class', 'aw-epInstructionsEffectivity-upCheckboxDefault' );
        }
    }
};

SummaryEffectivity.prototype.showToolTip = function( event ) {
    let resource = localeService.getLoadedText( instrMessagePath );

    let toolTip = document.getElementById( 'wiEffectivityToolTip' );
    let rectElement = event.target;
    let toolTipPosition = rectElement.getBoundingClientRect();
    if( toolTip ) {
        toolTip.style.left = toolTipPosition.left - 20 + 'px';
        toolTip.style.top = toolTipPosition.top - 58 + 'px';
        toolTip.style.display = 'block';
        toolTip.style.align = 'center';

        // tool tip showing operations as well as units
        let unit = parseInt( rectElement.getAttribute( 'unit' ) );
        let summaryItem = this.summaryUnitList[ unit - 1 ];
        if( summaryItem.length > 1 ) {
            let tooltipString = resource.summaryRowOverlapTooltipMessage.format( unit );

            toolTip.innerHTML = tooltipString;
        } else if( summaryItem.length === 0 ) {
            toolTip.innerHTML = resource.summaryRowGapTooltipMessage.format( unit );
        } else {
            toolTip.innerHTML = resource.unitTooltip.format( rectElement.getAttribute( 'unit' ) );
        }
    }
};

SummaryEffectivity.prototype.hideToolTip = function( event ) {
    let toolTip = document.getElementById( 'wiEffectivityToolTip' );
    if( toolTip ) {
        toolTip.style.display = 'none';
    }
};

const exports = {
    createSummaryEffectivity
};
export default exports;
