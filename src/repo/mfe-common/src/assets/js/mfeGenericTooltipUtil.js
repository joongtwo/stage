// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * Utility related to generic tooltips
 *
 * @module js/mfeGenericTooltipUtil
 */
import popupSvc from 'js/popupService';
import ccu from 'js/commandConfigUtils.service';
import { getLocalizedText } from 'js/localeService';
import parsingUtils from 'js/parsingUtils';
import AwPromiseService from 'js/awPromiseService';



let cellIconIndicationTooltipRefElem = null;
const TOOLTIP_SHOULD_NOT_BE_VISIBLE = 'tooltipShouldNotBeVisible';

/**
 * Resolve an i18n reference from commandsViewModel.json
 *
 * @param {object} props - the props object
 * @returns {Object} The resolved string values
 */
export function resolveI18n( props ) {
    if( props.subPanelContext && props.subPanelContext.extendedTooltip ) {
        return ccu.getCommandsViewModel().then(
            ( commandsViewModel ) => {
                const tooltipData = { ...props.subPanelContext.extendedTooltip };
                let allI18nPromise = [];
                if( tooltipData.title ) {
                    allI18nPromise.push( getLocalizedValue( tooltipData.title, commandsViewModel ).then(
                        resolvedTitle => tooltipData.title = resolvedTitle
                    ) );
                }
                if( tooltipData.instruction ) {
                    allI18nPromise.push( getLocalizedValue( tooltipData.instruction, commandsViewModel ).then(
                        resolvedInstruction => tooltipData.instruction = resolvedInstruction
                    ) );
                }
                if( tooltipData.information ) {
                    allI18nPromise.push( getLocalizedValue( tooltipData.information, commandsViewModel ).then(
                        resolvedInformation => tooltipData.information = resolvedInformation
                    ) );
                }
                if( Array.isArray( tooltipData.messages ) && tooltipData.messages.length > 0 ) {
                    for( let index = 0; index < tooltipData.messages.length; index++ ) {
                        const message = tooltipData.messages[ index ];
                        allI18nPromise.push( getLocalizedValue( message, commandsViewModel ).then(
                            resolvedMessage => tooltipData.messages[ index ] = resolvedMessage
                        ) );
                    }
                }
                return AwPromiseService.instance.all( allI18nPromise ).then( () => tooltipData );
            } );
    }
}

/**
 * Get Localized Value
 * @param {string} i18nRef - i18nRef
 * @param {object} commandsViewModel - commandsViewModel
 * @returns {Html} a react html element
 */
function getLocalizedValue( i18nRef, commandsViewModel ) {
    const reference = parsingUtils.getStringBetweenDoubleMustaches( i18nRef );
    if( reference && reference.startsWith( 'i18n.' ) ) {
        let key = reference.slice( 5 );
        const resource = commandsViewModel.i18n[ key ] ? commandsViewModel.i18n[ key ][ 0 ] : '';
        return getLocalizedText( resource, key );
    }
    return Promise.resolve( reference );
}

/**
 * Displays the consumption indication tooltip
 *
 * @param {string} reference - the reference id the popup is relative to
 * @param {object} extendedTooltipArgs - the tooltip arguments
 */
export function displayCellIconIndicationTooltip( reference, extendedTooltipArgs ) {
    const { title, messages, instruction, information, className, noDefaultStyling = false } = extendedTooltipArgs;
    const popupData = {
        declView: 'MfeGenericTooltipPopup',
        subPanelContext: {
            extendedTooltip: {
                title,
                messages,
                instruction,
                information,
                className
            },
            noDefaultStyling
        },
        options: {
            hasArrow: true,
            reference,
            placement: 'right',
            forceCloseOthers: false,
            whenParentScrolls: 'close',
            padding: {
                x: 3,
                y: 20
            }
        }
    };
    popupSvc.show( popupData ).then( ( popupRef ) => {
        if( cellIconIndicationTooltipRefElem === TOOLTIP_SHOULD_NOT_BE_VISIBLE ) {
            cellIconIndicationTooltipRefElem = popupRef;
            hideCellIconIndicationTooltip();
        } else {
            cellIconIndicationTooltipRefElem = popupRef;
        }
    } );
}

/**
 * Hides the consumption indication tooltip
 */
export function hideCellIconIndicationTooltip() {
    if( cellIconIndicationTooltipRefElem ) {
        popupSvc.hide( cellIconIndicationTooltipRefElem );
        cellIconIndicationTooltipRefElem = null;
    } else {
        cellIconIndicationTooltipRefElem = TOOLTIP_SHOULD_NOT_BE_VISIBLE;
    }
}

/**
 *
 * @param {object[]} values - an array of objects which
 * @returns {boolean} true if all of the values of the array are of type string
 */
function allValuesUndefinedOrOfTypeString( values ) {
    return values.every( ( value ) => typeof value === 'undefined' || typeof value === 'string' );
}

/**
 *
 * @param {object} props - the props object
 * @returns {Html} a react html element
 */
export function renderMfeGenericTooltip( props ) {
    if( props.subPanelContext && props.subPanelContext.extendedTooltip ) {
        // eslint-disable-next-line max-len
        const { title, messages = [], instruction, information, className } = props.viewModel.data && props.viewModel.data.tooltipData ? props.viewModel.data.tooltipData : props.subPanelContext.extendedTooltip;
        //we want to render the tooltip only when all of the given values are strings
        //because some given values are objects which need interpolation or localization with parameters.
        //since the localization thread is independent of the rendering, we must wait for the values
        //to get evaluated properly
        if( allValuesUndefinedOrOfTypeString( [ title, ...messages, instruction, information ] ) ) {
            const classStyle = className ? `aw-mfe-genericTooltipContainer ${className}` : 'aw-mfe-genericTooltipContainer';
            return (
                <div className={classStyle}>
                    <div className='aw-mfe-tooltipContent'>
                        {getTitleSection( title, messages, instruction, information )}
                        {getMessagesSection( messages )}
                        {getInstructionSection( instruction )}
                    </div>
                    {getInformationSection( information )}
                </div>
            );
        }
    }
    return null;
}

/**
 *
 * @param {string} title - the title of the tooltip
 * @param {string[]} messages - the messages of the tooltip
 * @param {string} instruction - the instruction of the tooltip
 * @param {string} information - the information of the tooltip
 * @returns {Html} the title html
 */
function getTitleSection( title, messages, instruction, information ) {
    const titleOnly = !instruction && !information && ( !messages || Array.isArray( messages ) && messages.length === 0 );
    const classStyle = titleOnly ? 'aw-mfe-tooltipTitle aw-mfe-tooltipTitleOnly' : 'aw-mfe-tooltipTitle';
    return title ? <div className={classStyle}>{title}</div> : null;
}

/**
 *
 * @param {string[]} messages - array of the messages of the tooltip
 * @returns {Html} the messages html
 */
function getMessagesSection( messages ) {
    if( Array.isArray( messages ) && messages.length > 0 ) {
        return (
            messages.map( ( msg, index ) => <div key={index} className='aw-mfe-tooltipRowMessage'>{msg}</div> )
        );
    }
    return null;
}

/**
 *
 * @param {string} instruction - the instruction of the tooltip
 * @returns {Html} the instruction html
 */
function getInstructionSection( instruction ) {
    return instruction ? <div className='aw-mfe-tooltipInstruction'>{instruction}</div> : null;
}

/**
 *
 * @param {string} information - the information of the tooltip
 * @returns {Html} the information html
 */
function getInformationSection( information ) {
    return information ? <div className='aw-mfe-tooltipInformation aw-mfe-informationWarning'>{information}</div> : null;
}

// eslint-disable-next-line no-unused-vars
let exports;
export default exports = {
    resolveI18n,
    displayCellIconIndicationTooltip,
    hideCellIconIndicationTooltip,
    renderMfeGenericTooltip
};
