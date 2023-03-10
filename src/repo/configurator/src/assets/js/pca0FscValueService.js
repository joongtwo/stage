// Copyright (c) 2022 Siemens
/*eslint-disable jsx-a11y/click-events-have-key-events*/
/*eslint-disable jsx-a11y/no-static-element-interactions*/

/**
 * Helper service for pca0valueView
 *
 * @module js/pca0FscValueService
 */

import eventBus from 'js/eventBus';
import appCtxSvc from 'js/appCtxService';
import AwPromiseService from 'js/awPromiseService';
import AwTimeoutService from 'js/awTimeoutService';
import pcaSelectionService from 'js/Pca0FscSelectionService';
import configuratorUtils from 'js/configuratorUtils';
import iconSvc from 'js/iconService';
import dateTimeService from 'js/dateTimeService';
import pca0Constants from 'js/Pca0Constants';
import _ from 'lodash';
import { getField } from 'js/utils';
import AwIcon from 'viewmodel/AwIconViewModel';
import AwDefaultCell from 'viewmodel/AwDefaultCellViewModel';
import AwCellCommandBar from 'viewmodel/AwCellCommandBarViewModel';
import AwDate from 'viewmodel/AwDateViewModel';
import AwTextBox from 'viewmodel/AwTextboxViewModel';
import Pca0FscValueIcon from 'viewmodel/Pca0FscValueIconViewModel';

var exports = {};
var $timeout = AwTimeoutService.instance;
var timeout = null;
var clickCount = 0;

const ValidationCriteriaForIntFamily = /^(<|>|<=|>=)?(\s?)(\d+)(\s?)(&?)(\s?)(<|<=|>|>=)?(\s?)(\d*?)$/;
const ValidationCriteriaForDoubleFamily = /^(<|>|<=|>=)?(\s?)(\d+)(\.?\d*?)(\s?)(&?)(\s?)(<|<=|>|>=)?(\s?)(\d*?)(\.?\d*?)$/;

/**
 * Resets the temporary state for the icon, sets state to passed one
 * @param {Integer} selState - selected state
 * @returns {Object} - result
 */
export const resetTempState = ( selState ) => {
    return { icon: '', state: selState };
};

/**
 * Updates the Value Indicators
 * @param {Object} props - The props object
 * @returns {Object} - result
 */
export const updateValueIndicators = ( props ) => {
    var systemSelection;
    if( !props.value.optValue.indicators ) {
        props.value.optValue.indicators = [];
    }
    var newVal = {
        ...props.value,
        optValue: { ...props.value.optValue, indicators: [ ...props.value.optValue.indicators ] }
    };
    var optValue = newVal.optValue;
    var indicators = newVal.optValue ? newVal.optValue.indicators : [];
    // Process System/Default selections
    // Ignore "Exclude" indicator as this is not present in Features middle view
    var selectionStateindicator = undefined;
    var img;
    if( props.value.selectionState === 9 || props.value.selectionState === 10 ) {
        var sysSelectionIndicatorImage = 'indicatorSystemSelection';
        systemSelection = sysSelectionIndicatorImage;
        img = 'indicatorSystemSelection';
        selectionStateindicator = {
            tooltip: props.value.systemSelectionIndicatorTooltip,
            image: img
        };
    } else if( props.value.selectionState === 5 || props.value.selectionState === 6 ) {
        var defaultSelectionIndicatorImage = 'indicatorDefaultSelection';
        systemSelection = defaultSelectionIndicatorImage;
        img = 'indicatorDefaultSelection';
        selectionStateindicator = {
            tooltip: props.value.defaultSelectionIndicatorTooltip,
            image: img
        };
    }

    // Process Unconfigured option
    var unconfiguredIndicator = undefined;
    if( props.value.isUnconfigured ) {
        img = 'indicatorConfiguredOut';
        unconfiguredIndicator = {
            tooltip: props.value.isUnconfiguredIndicatorTooltip,
            image: img
        };
    }

    if( props.value.isThumbnailDisplay ) {
        // Update "selectionState" and "unconfigured" indicator only
        // Do not change/remove existing violation indicators

        // Selection state
        if( newVal.optValue.indicators ) {
            _.remove( indicators, {
                type: 'selectionState'
            } );
        }

        if( !_.isUndefined( selectionStateindicator ) ) {
            selectionStateindicator.type = 'selectionState';
            indicators.push( selectionStateindicator );
        }

        // Unconfigured
        if( newVal.optValue.indicators ) {
            _.remove( indicators, {
                type: 'unconfigured'
            } );
        }
        if( !_.isUndefined( unconfiguredIndicator ) ) {
            unconfiguredIndicator.type = 'unconfigured';
            indicators.push( unconfiguredIndicator );
        }
    }

    if( optValue && ( optValue.indicators || indicators ) ) {
        optValue.indicators = indicators;
    }

    newVal.optValue = optValue;
    //do not update if the content is the same. (Unfortunately you need to update parent because the indicators are on the transmitted prop)
    if( !_.isEqual( newVal.optValue.indicators, props.value.optValue.indicators ) ) {
        eventBus.publish( 'Pca0FscValue.updateValue', { oldValue: props.value, newValue: newVal, path: { famIndex: props.famIndex, index: props.index } } );
    }
    return {
        systemSelection: systemSelection
    };
};

/**
 * Updates the violation icons.
 * @param {Object} props - The props object
 * @returns {Object} - result
 */
export const updateViolationIcon = ( props ) => {
    var violationImage = '';
    if( !props.value.optValue.indicators ) {
        props.value.optValue.indicators = [];
    }
    var newVal = {
        ...props.value,
        optValue: { ...props.value.optValue, indicators: [ ...props.value.optValue.indicators ] }
    };

    var violationExist = newVal.hasViolation;
    var indicators = newVal.optValue ? newVal.optValue.indicators : [];
    var optValue = newVal.optValue;

    // Update "violation" indicator only
    // Do not change/remove existing "selectionState" and "unconfigured" indicators
    if( newVal.optValue && newVal.optValue.indicators ) {
        _.remove( indicators, {
            type: 'violation'
        } );
    }
    var img;
    var violationClass;
    if( violationExist ) {
        var violationSeverity = props.value.violationsInfo.violationSeverity;
        if( violationSeverity === 'error' ) {
            violationImage = 'indicatorError';
            violationClass = 'aw-cfg-violationErrorImage';
            img = 'indicatorError';
        } else if( violationSeverity === 'warning' ) {
            violationImage = 'indicatorWarning';
            violationClass = 'aw-cfg-violationWarningImage';
            img = 'indicatorWarning';
        } else if( violationSeverity === 'info' ) {
            violationImage = 'indicatorInfo';
            violationClass = 'aw-cfg-violationInfoImage';
            img = 'indicatorInfo';
        }
        if( !props.value.optValue.indicators ) {
            indicators = [];
            optValue = {
                uid: '_freeFormFeature_',
                cellHeader1: props.value.dbValue,
                typeIconURL: iconSvc.getTypeIconURL( pca0Constants.CFG_OBJECT_TYPES.TYPE_LITERAL_FEATURE ),
                indicators: []
            };
        }
        indicators.push( {
            type: 'violation',
            tooltip: props.value.violationsInfo.violationMessage,
            image: img
        } );
    }
    if( optValue && ( optValue.indicators || indicators ) ) {
        optValue.indicators = indicators;
    }

    newVal.optValue = optValue;
    //do not update if the content is the same. (Unfortunately you need to update parent because the indicators are on the transmitted prop)
    if( !_.isEqual( newVal.optValue.indicators, props.value.optValue.indicators ) ) {
        eventBus.publish( 'Pca0FscValue.updateValue', { oldValue: props.value, newValue: newVal, path: { famIndex: props.famIndex, index: props.index } } );
    }

    return {
        violationImage: violationImage,
        violationClass: violationClass,
        optValue: optValue
    };
};

/**
 * Fires the FSCEvent close event
 * @param {String} variantcontext - The variantcontext
 * @param {String} valueaction - The valueaction
 * @returns {Object} - promise
 */
var fireFSCEvents = function( variantcontext, valueaction ) {
    var deferred = AwPromiseService.instance.defer();
    if( 'fscContext' === variantcontext && 'selectFeature' === valueaction ) {
        eventBus.publish( 'Pca0FSCPackage.closePanel', {} );
    }
    deferred.resolve();
    return deferred.promise;
};

/**
 * Sets the optional value string
 * @param {Object} the value
 * @returns {String} - formated date
 */
var setOptValueStr = function( value ) {
    var optValueStr = value.optValueStr;
    var indx = value.optValueStr.indexOf( ':' );
    if( indx > -1 ) {
        var familyID = value.optValueStr.substring( 0, indx );
        optValueStr = familyID + ':' + value.dbValue;
    }
    return optValueStr;
};

/**
 * Helper to get the date string formatted
 * @param {Object} dateToFormat - date
 * @returns {String} - formated date
 */
var getFormattedDateString = function( dateToFormat ) {
    return dateToFormat.getFullYear().toString() + '-' + ( dateToFormat.getMonth() + 1 ).toString().padStart( 2, '0' ) + '-' + dateToFormat.getDate().toString().padStart( 2,
        '0' ) + 'T00:00:00Z';
};

/**
 * Evaluates the new selection state based of type of click (Single/Double) and variant mode (Guided/Manual)<
 * @param {Object} props - The props
 * @param {Object} context - The context
 * @param {Boolean} isSingleClick - Single Click
 * @returns {Integer} - state
 */
var evaluateNextSelectionState = function( data, props, context, isSingleClick ) {
    var state = 0;
    if( context.guidedMode ) {
        //In guided mode we get new allowedSelectionStates on every click
        if( isSingleClick ) {
            //Move one state at a time
            state = props.value.allowedSelectionStates[ 0 ];
        } else {
            //Move two states at a time
            state = props.value.allowedSelectionStates[ 1 ];
        }
    } else {
        //for the current mode you cannot rely on the freshness of the state from the prop, so take it from the data
        var tempState = _.get( data, 'data.tempSelection' ) ? data.tempSelection.state : props.value.selectionState;
        //Take the index of current selection state
        var index = props.value.allowedSelectionStates.indexOf( tempState );
        //Calculate the index of new state
        if( isSingleClick ) {
            //Move one state at a time
            index = ( index + 1 ) % props.value.allowedSelectionStates.length;
        } else { //Handle double click
            //Move two states at a time
            index = ( index + 2 ) % props.value.allowedSelectionStates.length;
        }
        //Take the new state from allowed selection states
        state = props.value.allowedSelectionStates[ index ];
    }
    return state;
};

/**
 * Handles the select and the states based on the nr of clicks
 * @param {Object} data - The view model object
 * @param {Object} props - The props
 * @param {Boolean} isSingleClick - Single Click
 * @param {Integer} setAsSelected - selection state
 */
var select = function( data, props, isSingleClick, setAsSelected = undefined ) {
    var context = appCtxSvc.getCtx( props.variantcontext );

    var state;
    var optValueStr = props.value.optValueStr;
    if( setAsSelected !== undefined ) {
        state = setAsSelected;
    } else {
        // Evaluate new selection state based on single and double click
        state = Number( evaluateNextSelectionState( data, props, context, isSingleClick ) );
    }

    var updatedVal = { ...props.value };

    //In case of free form family the feature needs to have vmo created for tile display in summary section
    if( props.value.isFreeFormFeature ) {
        var displayValue = props.value.dbValue;
        var vmo = {
            uid: '_freeFormFeature_',
            cellHeader1: displayValue,
            typeIconURL: iconSvc.getTypeIconURL( pca0Constants.CFG_OBJECT_TYPES.TYPE_LITERAL_FEATURE ),
            indicators: []
        };
        if( props.value.type === 'DATE' ) {
            var isRange = typeof props.value.dbValue === 'string' && props.value.dbValue.search( />=|<|>|<=/ ) >= 0;
            if( isRange ) {
                updatedVal.uiValue = props.value.dbValue;
                updatedVal.error = ''; //clear the date error as we are using it as string, is already validated
                updatedVal.optValue = props.value.optValue;
                vmo.cellHeader1 = props.value.optValue.cellHeader1;
            } else {
                vmo.cellHeader1 = props.value.uiValue;
                //in case this is a simple select vs a true date change make sure you have all the date pieces
                var newDate = new Date( props.value.uiValue );
                if( newDate ) {
                    updatedVal.dateApi.dateObject = newDate;
                    updatedVal.dbValue = getFormattedDateString( newDate );
                }
                updatedVal.uiValue = dateTimeService.formatDate( props.value.uiValue );
            }

            if( typeof displayValue === 'string' && displayValue.search( />=|<|>|<=/ ) >= 0 ) {
                updatedVal.isDateRangeExpr = true;
            }
        }
        updatedVal.optValueStr = optValueStr;
        updatedVal.optValue = vmo;
        updatedVal.state = state;

        if( data.dispatch ) {
            data.dispatch( { path: 'data.title', value: displayValue } );
        }
    }
    updatedVal.selectionState = state;
    var perspectiveUid;
    if( props.valueaction === 'selectPackageOption' ) {
        perspectiveUid = context.configPerspective.uid;
    } else {
        perspectiveUid = props.configuid;
    }

    var selectionData = {
        variantcontext: props.variantcontext,
        valueaction: props.valueaction,
        value: updatedVal,
        family: props.family,
        state: state,
        perspectiveUid: perspectiveUid,
        path: { famIndex: props.famIndex, index: props.index }
    };

    //update to trigger the refresh of the undelaying icon component - for the time being in which the component is not updated through its value prop the click on the tile gets reflected 
    //in the icon underneath
    let val = exports.updateIcon( props, state );

    //dispatch the change here so we'll update the icon, dispatch via json not possible via json return value.
    if( data.dispatch ) {
        data.dispatch( { path: 'data.tempSelection', value: { icon: val, state: state } } );
    }
    //set the selection via the legacy way - this whole action should be on atomic data
    pcaSelectionService.setSelection( selectionData, false, props.value );
};

/**
 * Validates the entries into the free-form text box - incorporated change from cp PLM681526
 * @param {Object} props - The view model object
 * @returns {Object} - validationCriteria
 */
var validateFreeFormTextBox = function( props ) {
    var validationCriteria = {};
    // 1.(<|>|<=|>=)?  ->support only this operators and only one at a time. All are optional
    // 2.(\s?)     -> adding a single space is an optional.
    // 3.(\d+) -->required any  number.
    // 4. (\s?) -->After a number user can add single space which is an optionl.
    // 5.(&?) -->Support this operators only.Its an optional.
    // 6.(\s?)  -->After operator user can add single space which is an optonal.
    // 7.(<|<=|>|>=)?--> support only this operators and only one at a time. All are optional
    // 8.(\s?)(\d*?) -->support single space with any numbers. all are optional
    if( props.value.validationCriteria ) {
        if( props.family.familyType === 'Integer' && !ValidationCriteriaForIntFamily.test( props.value.dbValue ) ) {
            validationCriteria = configuratorUtils.getFscLocaleTextBundle().ValidationErrorMesgForIntFreeForm;
        } else if( props.family.familyType === 'Floating Point' && !ValidationCriteriaForDoubleFamily.test( props.value.dbValue ) ) {
            validationCriteria = configuratorUtils.getFscLocaleTextBundle().ValidationErrorMesgForDoubleFreeForm;
        } else {
            validationCriteria = null;
        }
    }
    return validationCriteria;
};

/**
 * Updates the selection icons.
 * @param {Object} props - The props object
 * @param {Object} selState - reason for passing it here is so you can come from either refreshed props or updated internal value
 * @returns {Object} - result
 */
export const updateIcon = ( props, selState ) => {
    let context = appCtxSvc.getCtx( props.variantcontext );
    let selectionImage;
    let selectionState = !_.isUndefined( selState ) ? selState : props.value.selectionState;

    let isBoolean = props.family && props.family.familyType === 'Boolean';
    if( context ) {
        if( !isBoolean && context.guidedMode && [ 0 ].includes( selectionState ) &&
            props.family.singleSelect ) {
            // Show radio for single-select value in guided mode
            selectionImage = 'miscUiRadioUnselectedFocus';
        } else if( !isBoolean && context.guidedMode && [ 1, 5, 9 ].includes( selectionState ) &&
            props.family.singleSelect ) {
            // Show radio selection for single-select value in guided mode
            selectionImage = 'miscUiRadioSelected';
        } else if( [ 0 ].includes( selectionState ) &&
            ( !props.family.singleSelect || !context.guidedMode || isBoolean ) ) {
            // Show empty checkbox for single-select option family in manual mode
            // Show empty checkbox for multi-select family in both guided and manual mode
            // Show empty checkbox for boolean option family in manual mode
            selectionImage = 'miscUiCheckboxUnselectedPressed';
        } else if( [ 1, 5, 9 ].includes( selectionState ) &&
            ( !props.family.singleSelect || !context.guidedMode || isBoolean ) ) {
            // Show checkmark for single-select option family in manual mode
            // Show checkmark for multi-select family in both guided and manual mode
            // Show checkmark for boolean option family in manual mode
            selectionImage = 'miscUiCheckboxSelected';
        } else if( [ 2, 6, 10 ].includes( selectionState ) ) {
            selectionImage = 'miscUiExcludeBox';
            // element.removeClass( 'aw-cfg-multiSelectOptionValueLabelSelected' );
            // element.removeClass( 'aw-cfg-multiSelectOptionValueLabelUnSelected' );
        }
    }
    return selectionImage;
};

export const textValueChange = ( data, props, newValue ) => {
    let oldVal = { ...props.value };
    if( props.value.isFreeFormFeature && newValue !== props.value.dbValue ) {
        let val = props.value;
        val.dbValue = newValue;
        val.dispValue = newValue;
        val.uiValue = newValue;
        val.validationCriteria[ 0 ] = validateFreeFormTextBox( props );
        if( !val.validationCriteria[ 0 ] ) {
            if( newValue ) {
                var context = appCtxSvc.getCtx( props.variantcontext );
                if( !context.guidedMode ) {
                    select( data, props, true, 0 );
                }
                val.optValueStr = setOptValueStr( val );
                select( data, props, true, 1 );
            } else {
                select( data, props, true, 0 );
            }
        } else {
            eventBus.publish( 'Pca0FscValue.updateValue', { oldValue: oldVal, newValue: val, path: { famIndex: props.famIndex, index: props.index } } );
        }
    }
};

export const dateValueChange = ( data, props, newDate ) => {
    if( props.value.isFreeFormFeature && props.value.type === 'DATE' && newDate !== props.value.dbValue && !props.value.error ) {
        let val = props.value;
        val.dbValue = newDate && newDate.target.value ? getFormattedDateString( newDate.target.value ) : '';
        val.uiValue = dateTimeService.formatDate( newDate.target.value );
        val.dateApi.dateObject = newDate.target.value;
        if( props.value.dbValue === newDate.target.value ) {
            return;
        }
        //do an automatic selection of the entered feature
        if( newDate ) {
            let context = appCtxSvc.getCtx( props.variantcontext );
            if( !context.guidedMode ) {
                // This is to handle update of existing date selection in manual mode.
                select( data, props, true, 0 );
            }
            //update parent with new value
            val.optValueStr = setOptValueStr( val );
            eventBus.publish( 'Pca0FscValue.updateValue', { oldValue: props.value, newValue: val, path: { famIndex: props.famIndex, index: props.index } } );
            select( data, props, true, 1 );
        } else if( props.value.selectionState === 1 && props.value.dateApi.dateValue === '' ) {
            //update parent with new value
            eventBus.publish( 'Pca0FscValue.updateValue', { oldValue: props.value, newValue: val, path: { famIndex: props.famIndex, index: props.index } } );
            select( data, props, true, 0 );
        }
    }
};

/**
 * Handles the delayed text value changed event.
 * It cannot be inside the render function as it would be a new function for every render and therefore render the debounce obsolete.
 * @param {Object} actions - passed in actions
 * @param {Object} newValue - The new value
 */
const textValChangeAction = _.debounce( ( actions, newValue ) => {
    actions.textValueChanged();
}, 800, { leading: false, trailing: true } );

/**
 * Handles the click on the fsc value element.
 * @param {Object} data - The props object
 * @param {Object} props - The props object
 */
export let handleValueClick = function( data, props ) {
    let preferences = appCtxSvc.getCtx( 'preferences' );
    if( _.get( preferences, 'Pca0DisableTimersForPerformanceRun[0]' ) === 'true' ) {
        fireFSCEvents( props.variantcontext, props.valueaction ).then( () => {
            select( data, props, true );
        } );
    } else {
        clickCount++;
        //If package panel is open in FSC then close it first when user clicks on a feature in FSC
        //There is no double click action (because of touch-screen support) so we have to still implement it ourselves
        fireFSCEvents( props.variantcontext, props.valueaction ).then( function() {
            if( clickCount === 1 ) {
                timeout = $timeout( function() {
                    clickCount = 0;
                    // single click case
                    select( data, props, true );
                }, 400 );
            } else if( clickCount === 2 ) {
                $timeout.cancel( timeout );
                clickCount = 0;
                // double click case
                select( data, props, false );
            }
        } );
    }
};

/**
 * Rendering method
 *
 * @param {Object} props - props
 * @returns {Object} - Returns view
 */
export const pca0FscValueRenderFunction = ( props ) => {
    let { fields, viewModel, actions } = props;

    let { data } = viewModel;
    if( props.value.validationCriteria && props.value.validationCriteria[ 0 ] ) {
        fields.textValue.error = props.value.validationCriteria;
        fields.dateValue.error = props.value.validationCriteria;
    } else {
        fields.textValue.error = null;
        fields.dateValue.error = null;
    }

    //update the field for the undelaying icon component 
    //for the time being in which the component is not updated through its value prop the click on the tile gets reflected 
    //in the icon underneath - the extraction was done to improve performance in manual mode selection. 
    let val = exports.updateIcon( props );
    if( !data.tempSelection || data.tempSelection.icon === '' ) {
        fields.selection.value = val;
    } else {
        fields.selection.value = data.tempSelection.icon;
    }

    const getTitle = ( props ) => {
        var title;
        if( ( props.family && props.family.isThumbnailDisplay || props.value.isThumbnailDisplay ) && props.value.optValue ) {
            title = props.value.optValue.cellHeader1;
        }
        return title;
    };

    const getViolationIndicator = ( props ) => {
        //this is only for the free form the rest in encapsulated in the indicators of the default cell
        let ret = exports.updateViolationIcon( props );
        exports.updateValueIndicators( props );
        let violationIndicator = ret.violationImage;

        switch ( violationIndicator ) {
            case 'indicatorWarning':
                return <AwIcon iconId='indicatorWarning'></AwIcon>;
            case 'indicatorInfo':
                return <AwIcon iconId='indicatorInfo'></AwIcon>;
            case 'indicatorError':
                return <AwIcon iconId='indicatorError'></AwIcon>;
            default:
                return;
        }
    };

    const getSystemSelectionIndicator = ( props ) => {
        let systemSel = exports.updateValueIndicators( props );
        //this is only for the free form the rest in encapsulated in the indicators of the default cell
        switch ( systemSel.systemSelection ) {
            case 'indicatorSystemSelection':
                return <AwIcon iconId='indicatorSystemSelection'></AwIcon>;
            case 'indicatorDefaultSelection':
                return <AwIcon iconId='indicatorDefaultSelection'>   </AwIcon>;
            default:
                return;
        }
    };

    //handle it outside the render function so you can debounce it
    const textValChangeToDebounce = ( newValue ) => {
        textValChangeAction( actions, newValue );
    };

    const dateValChange = ( newDate ) => {
        exports.dateValueChange( viewModel, props, newDate );
    };

    const keyPressed = function( event ) {
        if( event.key === 'Enter' ) {
            actions.handleValueClick();
        }
    };
    const basicValueClasses = 'aw-cfg-value aw-cfg-optionValueCellRow';
    const freeFormTextCommandBarClass = props.family.familyType !== 'Date' ? 'aw-cfg-freeFormTextCommandBar' : 'aw-cfg-freeFormDateCommandBar';
    const freeFormIconClass = props.value.isDateRangeExpr && !props.value.isFreeFormFeature ? 'aw-cfg-fscSelectedImageThumbnail' :
        'aw-cfg-fscSelectedImageThumbnail aw-cfg-FreeFormIcon sw-aria-border';
    const noThumbnailLabelClass = props.value.selectionState !== 0 ? 'aw-base-normal aw-cfg-valueLabel' : 'aw-base-normal aw-ui-filterNameLabel aw-cfg-valueLabel';

    const getValueClasses = ( props ) => {
        //note: this is only needed for the test locators
        var valueClasses = basicValueClasses;
        var violationClass;
        if( props.value.violationsInfo && props.value.violationsInfo.violationSeverity ) {
            var violationSeverity = props.value.violationsInfo.violationSeverity;
            if( violationSeverity === 'error' ) {
                violationClass = 'aw-cfg-violationErrorImage';
            } else if( violationSeverity === 'warning' ) {
                violationClass = 'aw-cfg-violationWarningImage';
            } else if( violationSeverity === 'info' ) {
                violationClass = 'aw-cfg-violationInfoImage';
            }
            valueClasses = valueClasses + ' ' + violationClass;
        }
        return valueClasses;
    };

    const getFreeFormClasses = ( props ) => {
        var ffClasses = freeFormIconClass;

        if( props.value.dbValue === '' || props.value.type === 'DATE' && !props.value.uiValue ) {
            return ffClasses + ' aw-cfg-disableSelection';
        }
        return ffClasses;
    };

    const getFreeFormTabIndex = ( props ) => {
        //free form should not be clickable if disabled (empty)
        var tabIndex = '0';

        if( props.value.dbValue === '' || props.value.type === 'DATE' && !props.value.uiValue ) {
            return '-1';
        }
        return tabIndex;
    };

    const renderFreeForm = () => {
        return (
            // FIXME for className={freeFormIconClass}, className='aw-cfg-fscOptionValueCell', visible non interactive elements with
            // click handler must have at least one keyboard listener, Static HTML elements with event handlers require a role
            <div className='aw-widgets-cellListItemContainer'>
                <div className='sw-row'>
                    <div className={getFreeFormClasses( props )} tabIndex={getFreeFormTabIndex( props )} role='button' onKeyDown={( event ) => keyPressed( event, data, props )}  onClick={actions.handleValueClick}   >
                        <Pca0FscValueIcon {...getField( 'fields.selection', fields )} key={props.value.dbValue}></Pca0FscValueIcon>
                    </div>
                    <div className='aw-cfg-freeFormSection'>
                        <div className='sw-column aw-default-cell aw-cfg-fscOptionValueCell'>
                            <div className='sw-property-val'>
                                {props.family.familyType !== 'Date' &&
                                  <AwTextBox  {...getField( 'data.textValue', fields )} key={props.value.dbValue}  className='aw-cfg-freeFormWidget'
                                      onSwChange={textValChangeToDebounce} ></AwTextBox>
                                }
                                {props.family.familyType === 'Date' && !props.value.isDateRangeExpr &&
                                      <AwDate  {...getField( 'data.dateValue', fields )} key={props.value.dbValue}  className='aw-cfg-freeFormWidget aw-cfg-freeFormDate' onChange={dateValChange}  ></AwDate>
                                }
                                {props.family.familyType === 'Date' && props.value.isDateRangeExpr && props.value.optValue &&
                                  <div className='aw-cfg-fscOptionValueCell' onClick={actions.handleValueClick}><AwDefaultCell
                                      key={props.value.optValue}  vmo={props.value.optValue} item={props.value.optValue} >
                                  </AwDefaultCell></div>
                                }
                            </div>
                            <AwCellCommandBar alignment='HORIZONTAL' className={freeFormTextCommandBarClass} anchor='freeFormFeatureCommandBar' context={{  family:props.family, value:props.value,  famIndex: props.famIndex, index: props.index,  configPerspectiveUid: props.configuid,  showEnumeratedRange:  getShowEnumeratedRange() }} >
                            </AwCellCommandBar>
                        </div>
                    </div>
                </div>
                <div className='sw-row demo-h-2f'>
                    <div className='aw-cfg-freeFormIndicator'>
                    </div>
                    <div className='aw-cfg-freeFormSection'>
                        {props.value.selectionState > 2 && <div className='aw-cfg-fsc-freeFormIndicatorBar'  title={props.value.systemSelectionIndicator}>
                            {    getSystemSelectionIndicator( props )   }
                        </div>
                        }
                        {props.value.violationsInfo !== undefined &&  <div className='aw-cfg-fsc-freeFormIndicatorBar' title={props.value.violationsInfo.violationMessage}>
                            {   getViolationIndicator( props )  }
                        </div>}
                    </div>
                </div>
            </div>
        );
    };
    const getShowEnumeratedRange = () => {
        return !appCtxSvc.getCtx( props.variantcontext ).guidedMode;
    };

    const renderNonFreeForm = () => {
        return (
            <div className='aw-widgets-cellListItemContainer sw-aria-border' role='button' tabIndex='0'  onClick={actions.handleValueClick} onKeyDown={( event ) => keyPressed( event, data, props )}>
                <div className='aw-cfg-fscValueThumbnail sw-component sw-row' >
                    <div className='aw-cfg-fscSelectedImageThumbnail'  >
                        <Pca0FscValueIcon {...getField( 'fields.selection', fields )} key={props.value.optValue}></Pca0FscValueIcon>
                    </div>
                    <div className='sw-row aw-default-cell aw-cfg-fscOptionValueCell aw-cfg-fscOptionValueCellNonFreeForm' >
                        <AwDefaultCell  key={props.value.optValue}  vmo={props.value.optValue} item={props.value.optValue} >
                        </AwDefaultCell>
                    </div>
                    { props.value.isEnumeratedRangeExpr &&
                        <AwCellCommandBar alignment='HORIZONTAL' className={freeFormTextCommandBarClass} anchor='enumeratedFeatureCommandBar' context={{  family:props.family, value:props.value, famIndex: props.famIndex, index: props.index, showEnumeratedRange:  getShowEnumeratedRange() }} >
                        </AwCellCommandBar>
                    }
                    {props.value.isPackage && props.variantcontext === 'fscContext' &&
                        <AwCellCommandBar alignment='HORIZONTAL' className='aw-cfg-packageInfoCommand' anchor='aw_fscShowPackage' context={{  packageFamily:props.family, packageValue:props.value, configPerspectiveUid: props.configuid }} >
                        </AwCellCommandBar>
                    }
                    {props.value.isPackage && props.variantcontext === 'variantConfigContext' &&
                        <AwCellCommandBar alignment='HORIZONTAL' className={freeFormTextCommandBarClass}
                            anchor='aw_showPackageWithTile' context={{ packageValue: props.value, packageFamilyUID: props.family.familyStr, singleselectect: props.family.singleSelect, configPerspectiveUid:props.configuid  }} >
                        </AwCellCommandBar>
                    }
                </div>
            </div>
        );
    };

    const renderNonFreeFormNoThumbnail = () => {
        return (
            <div className='aw-widgets-cellListItemContainer'>
                <div className='aw-cfg-fscValueThumbnail sw-component sw-row' role='button' tabIndex='0'  onClick={actions.handleValueClick} onKeyDown={( event ) => keyPressed( event, data, props )}>
                    <div className='aw-cfg-fscSelectedImageThumbnail'  >
                        <Pca0FscValueIcon {...getField( 'fields.selection', fields )} key={props.value.optValue}></Pca0FscValueIcon>
                    </div>
                    <div className={noThumbnailLabelClass} >
                        {props.value.valueDisplayName ? props.value.valueDisplayName : props.value.dispValue}
                    </div>
                </div>
                <div className='aw-cfg-fscIndicatorContainer'>
                    { props.value.isEnumeratedRangeExpr &&
               <AwCellCommandBar alignment='HORIZONTAL' className={freeFormTextCommandBarClass} anchor='enumeratedFeatureCommandBar' context={{ family:props.family, value:props.value, famIndex: props.famIndex, index: props.index, configPerspectiveUid: props.configuid, showEnumeratedRange:  getShowEnumeratedRange() }} >
               </AwCellCommandBar>
                    }
                    {props.value.isPackage && props.variantcontext === 'fscContext' &&
                          <AwCellCommandBar alignment='HORIZONTAL'
                              className='aw-cfg-packageInfoCommand'
                              anchor='aw_fscShowPackage'
                              context={{ packageFamily:props.family, packageValue:props.value,  configPerspectiveUid: props.configuid  }} >
                          </AwCellCommandBar>
                    }
                    {props.value.isPackage && props.variantcontext === 'variantConfigContext' &&
                          <AwCellCommandBar alignment='HORIZONTAL' className={freeFormTextCommandBarClass}
                              anchor='aw_showPackageWithTile' context={{ packageValue: props.value, packageFamilyUID: props.family.familyStr, singleSelect: props.family.singleSelect,  configPerspectiveUid: props.configuid  }} >
                          </AwCellCommandBar>
                    }
                </div>
                <div className='sw-row demo-h-2f'>
                    {props.value.selectionState > 2 && <div className='aw-cfg-systemSelection'  title={props.value.systemSelectionIndicator}>
                        {    getSystemSelectionIndicator( props )   }
                    </div>
                    }
                    {props.value.violationsInfo !== undefined &&  <div className='aw-cfg-violationImage' title={props.value.violationsInfo.violationMessage}>
                        {   getViolationIndicator( props )   }
                    </div>}
                </div>

            </div>
        );
    };

    if( props.value ) {
        if( props.value.isFiltered ) {
            if( !( props.family.isThumbnailDisplay || props.value.isThumbnailDisplay ) ) {
                return (
                    <div className='aw-cfg-fscValueNoThumbnail' title={getTitle( props )}>
                        { props.family.isFreeForm === false && renderNonFreeFormNoThumbnail()}
                        { props.family.isFreeForm === true && renderFreeForm()}
                    </div>
                );
            }
            return (
                <div className={getValueClasses( props )} title={getTitle( props )}>
                    { props.family.isFreeForm === false && renderNonFreeForm()}
                    { props.family.isFreeForm === true && renderFreeForm()}
                </div>
            );
        }
    }
};

const updateTextValue = ( data, props ) => {
    let textValue = { ...data.textValue };
    let dateValue = { ...data.dateValue };

    if( props.value.type === 'DATE' && ( props.value.dateApi.dateValue || props.value.dbValue || props.value.isDateRangeExpr ) ) {
        dateValue.dbValue = new Date( props.value.uiValue ).getTime();
        dateValue.dateApi.dateObject = new Date( props.value.uiValue );
        dateValue.dateApi.dateValue = dateTimeService.formatDate( data.dateValue.dateApi.dateObject, dateTimeService.getSessionDateFormat() );
        dateValue.dateApi.timeValue = dateTimeService.formatTime( data.dateValue.dateApi.dateObject, dateTimeService.getSessionTimeFormat() );
        dateValue.uiValue = props.value.uiValue;
    } else {
        textValue.dbValue = props.value.dbValue;
        textValue.uiValue = props.value.dbValue;
    }
    return {
        textValue,
        dateValue
    };
};
export default exports = {
    resetTempState,
    updateValueIndicators,
    updateViolationIcon,
    updateIcon,
    textValueChange,
    dateValueChange,
    updateTextValue,
    handleValueClick,
    pca0FscValueRenderFunction
};
