// Copyright (c) 2022 Siemens

import AwPanel from 'viewmodel/AwPanelViewModel';
import AwPanelBody from 'viewmodel/AwPanelBodyViewModel';
import AwPanelFooter from 'viewmodel/AwPanelFooterViewModel';
import AwButton from 'viewmodel/AwButtonViewModel';
import AwI18n from 'viewmodel/AwI18nViewModel';
import epDataCardService from 'js/epDataCardService';
/**render function for Data Card popup
 * @param {*} props context for render function interpolation
 * @returns {JSX.Element} react component
 */

let selectedActivities = undefined;

export function renderDataCardFn( props ) {
    if( !selectedActivities ) {
        selectedActivities = props.subPanelContext.selectedObjects;
    }
    return (
        <AwPanel>
            <AwPanelBody>
                <iframe title='datacard' src='datacard/index.html' className='w-12 h-12' onLoad={( e )=>contentLoadComplete( e, props.subPanelContext.inputObject )}></iframe>
            </AwPanelBody>
            <AwPanelFooter>
                <AwButton buttonType='base' size='auto' action={props.actions.closePopup}>
                    <AwI18n>{props.i18n.CancelButtonTitle}</AwI18n>
                </AwButton>
            </AwPanelFooter>
        </AwPanel>
    );
}

/**
 *
 * @param {*} e the event
 * @param {*} inputObject panel input
 */
function contentLoadComplete( e, inputObject ) {
    const frameset = getFrameset( e.currentTarget, 'frameset' );
    if( frameset ) {
        const cardFrame = frameset.children[ 1 ];
        setupDataCardClickHandler( cardFrame.contentWindow, inputObject );
        cardFrame.onload = () => {
            setupDataCardClickHandler( cardFrame.contentWindow, inputObject );
        };
    }
}

/**
 *
 * @param {*} contentWindow data card frame content element
 * @param {*} inputObject panel input
 */
function setupDataCardClickHandler( contentWindow, inputObject ) {
    if( contentWindow ) {
        contentWindow.onclick = () => epDataCardService.handleLibraryClicked( contentWindow.getSelection(), inputObject, selectedActivities );
    }
}

/**
 *
 * @param {*} element element
 * @param {String} frameName frame name
 * @returns {*} frameset
 */
function getFrameset( element, frameName ) {
    const childNodes = element.contentDocument.documentElement.childNodes;
    let frameset;
    for( let key in childNodes ) {
        if( childNodes[ key ].localName === frameName ) {
            frameset = childNodes[ key ];
            break;
        }
    }
    return frameset;
}

function updateSelectedActivity( selection ) {
    selectedActivities = selection;
}

function resetSelectedActivity() {
    selectedActivities = undefined;
}

export default {
    renderDataCardFn,
    updateSelectedActivity,
    resetSelectedActivity
};
