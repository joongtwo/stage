// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * Service for mfe messages
 *
 * @module js/mfeMessagesService
 */

import AwFlexColumn from 'viewmodel/AwFlexColumnViewModel';
import AwIcon from 'viewmodel/AwIconViewModel';
import messagingService from 'js/messagingService';



/**
 * Evaluate each message with its parameters
 *
 * @param {Object} messagesData - All the messages data
 *
 * @return {Object} messages text after applying passed parameters
 */
export function applyMessagesParams( messagesData ) {
    if( Array.isArray( messagesData ) ) {
        const messagesToParseList = messagesData.filter( msg => msg.textParams );
        messagesToParseList.forEach( ( msg ) => { msg.text = messagingService.applyMessageParamsWithoutContext( msg.text, msg.textParams ); } );
    }
    return messagesData;
}

/**
 * Set the loading parameter indicator
 *
 * @param {Boolean} isLoading - boolean
 * @return {boolean} the given object
 */
export function setLoadingIndicator( isLoading ) {
    return isLoading;
}

/**
 *
 * @param {object} props - the react component props object
 * @returns {HTML} a html element
 */
export function renderMfeMessagePanel( props ) {
    if( Array.isArray( props.messagesData.messageLines ) ) {
        const messagesDataArray = props.messagesData.messageLines.slice();
        //we need to
        applyMessagesParams( messagesDataArray );
        const formattedMsgs = [];
        messagesDataArray.forEach( ( msgData ) => {
            if( msgData.text ) {
                const splitLines = msgData.text.split( '\n' ).map( ( text ) => ( {
                    text,
                    className: msgData.className || ''
                } ) );
                if( msgData.iconId ) {
                    splitLines[splitLines.length - 1].iconId = msgData.iconId;
                }
                formattedMsgs.push( ...splitLines );
            } else {
                formattedMsgs.push( msgData );
            }
        } );
        return (
            <AwFlexColumn height='12' justify='center' align-content='center'>
                {formattedMsgs.map( ( msg, index )=> {
                    const className = msg.className ? `aw-mfe-messageLine ${msg.className}` : 'aw-mfe-messageLine';
                    return (
                        <div className={className} key={index}>
                            {renderMessageRow( msg.text, msg.iconId )}
                        </div>
                    );
                } )}
            </AwFlexColumn>
        );
    }
    return null;
}

/**
 *
 * @param {string} text - the text of the message
 * @param {string} iconId -the icon id of the icon to show
 * @returns {HTML} - the html eleemnt
 */
function renderMessageRow( text, iconId ) {
    if( text && iconId ) {
        return (
            <>
                <span>{text}</span>
                <span ><AwIcon className='aw-mfe-messageIcon' iconId={iconId}></AwIcon></span>
            </>
        );
    }
    if( text ) {
        return <span>{text}</span>;
    }
    if( iconId ) {
        return <span ><AwIcon className='aw-mfe-messageIcon' iconId={iconId}></AwIcon></span>;
    }
}


let exports;
export default exports = {
    applyMessagesParams,
    setLoadingIndicator,
    renderMfeMessagePanel
};
