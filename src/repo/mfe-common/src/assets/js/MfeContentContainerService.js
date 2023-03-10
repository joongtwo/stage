// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import AwSplitter from 'viewmodel/AwSplitterViewModel';
import localStorage from 'js/localStorage';
import eventBus from 'js/eventBus';
import { ShowWhen } from 'js/hocCollection';
const AwSplitterShowWhen = ShowWhen( AwSplitter );

const LOCAL_STORAGE_KEY = 'mfeAreaSizes';

const VERTICAL = 'VERTICAL';
const HORIZONTAL = 'HORIZONTAL';

/**
 * Render function for MfeContentRow
 * @param {*} props context for render function interpolation
 * @returns {JSX.Element} react component
 */
export const mfeContentRowRenderFunction = ( props ) => {
    return render( props, 'sw-flex-row', VERTICAL, HORIZONTAL );
};

/**
 * render function for MfeContentRow
 * @param {*} props context for render function interpolation
 * @returns {JSX.Element} react component
 */
export const mfeContentColumnRenderFunction = ( props ) => {
    return render( props, 'sw-flex-column', HORIZONTAL, VERTICAL );
};

/**
 * render function for MfeContentContainer
 * @param {*} props context for render function interpolation
 * @returns {JSX.Element} react component
 */
export const mfeContentContainerRenderFunction = ( props ) => {
    if ( props.containerDirection.toUpperCase() === HORIZONTAL ) {
        return mfeContentRowRenderFunction( props );
    }
    return mfeContentColumnRenderFunction( props );
};

/**
 * render function for Mfe Content Containers - Row or Column
 * @param {*} props context for render function interpolation
 * @param {String} containerClassName class (css) for the container
 * @param {String} splitterDirection HORIZONTAL or VERTICAL
 * @param {String} flexDirection HORIZONTAL or VERTICAL
 * @returns {JSX.Element} react component
 */
const render = ( props, containerClassName, splitterDirection, flexDirection ) => {
    const childrenWithSplitters = renderChildrenWithSplitter( props, splitterDirection, flexDirection );
    return (
        <div className={containerClassName} id={props.containerName} ref={props.elementRefList.get( 'area' )} >
            {childrenWithSplitters}
        </div>
    );
};
/**
 * Store the current size of the area
 * @param {String} containerName container name
 * @param {Boolean} isVertical is this area in vertical flex container
 * @param {Object} area area element to be stored
 */
const storeAreaSize = ( containerName, isVertical, area ) => {
    if ( isVertical ) {
        storeContentData( containerName, {
            height: area.clientHeight
        } );
    } else {
        storeContentData( containerName, {
            width: area.clientWidth
        } );
    }
};

/**
 * Store the received values for the content name (merge with existing data)
 * @param {String} contentName Content Name
 * @param {Object} values key values
 */
const storeContentData = ( contentName, values ) => {
    let dataToStore = {};
    let storedData = localStorage.get( LOCAL_STORAGE_KEY );
    if ( storedData ) {
        let preivousStoredData = JSON.parse( storedData );
        dataToStore[contentName] = { ...preivousStoredData[contentName], ...values };
        dataToStore = { ...preivousStoredData, ...dataToStore };
    }
    localStorage.publish( LOCAL_STORAGE_KEY, JSON.stringify( dataToStore ) );
};

/**
 *  Get the stored data for the given content name
 * @param {String} contentName Content Name
 * @returns {Object} key values that were stored
 */
const getStoredContentData = ( contentName ) => {
    let storedData = localStorage.get( LOCAL_STORAGE_KEY );
    if ( storedData ) {
        let parsedStoredData = JSON.parse( storedData );
        if ( parsedStoredData ) {
            return parsedStoredData[contentName];
        }
    }
};

/**
 * Restore the size of this area from stored size and set it to the area
 * @param {String} containerName container name
 * @param {Boolean} isVertical is this area in vertical flex container
 * @param  {Object} area area element to be stored
 */
const restoreAreaStoredData = ( containerName, isVertical, area ) => {
    let previousAreaData = getStoredContentData( containerName );
    if ( previousAreaData ) {
        let size = isVertical ? previousAreaData.height : previousAreaData.width;
        if ( size && area ) {
            area.style.flexBasis = `${size}px`;
            area.style.webkitFlexBasis = `${size}px`;
            area.style.flexGrow = '1';
            area.style.flexShrink = '1';
        }
    }
};

/**
 * Init the listener to resizes of this area, that will save restore size for this area.
 * @param {*} elementRefList element ref list
 * @param {*} props props
 */
export const initArea = ( elementRefList, props ) => {
    if ( props.flexDirection ) {
        let isVertical = props.flexDirection.toUpperCase() === VERTICAL;
        let area = elementRefList.get( 'area' ).current;

        elementRefList.get( 'handler' ).current = eventBus.subscribe( 'aw-splitter-update', ( eventData ) => {
            if ( eventData.area1 === area || eventData.area2 === area ) {
                storeAreaSize( props.containerName, isVertical, area );
            }
        } );

        restoreAreaStoredData( props.containerName, isVertical, area );
    }
};

export const destroyArea = ( elementRefList ) => {
    let handler = elementRefList.get( 'handler' ).current;
    eventBus.unsubscribe( handler );

    handler = null;
};

/**
 * Render the children and a spliter between each two children
 * @param {*} props the props of the component
 * @param {*} splitterDirection  HORIZONTAL or VERTICAL
 * @param {*} flexDirection  HORIZONTAL or VERTICAL
 * @returns {JSX.Element} react component
 */
const renderChildrenWithSplitter = ( props, splitterDirection, flexDirection ) => {
    let children = props.children;
    if ( !children ) {
        return null;
    }
    if ( !Array.isArray( children ) ) {
        children = [ children ];
    }

    let previousChild;
    return children.map( ( child, i ) => {
        let newChild = cloneElement( child, {
            flexDirection
        } );

        if ( i === 0 ) {
            previousChild = child;
            return newChild;
        }

        let splitter = <AwSplitter className='aw-mfe-transparentSplitter' direction={splitterDirection} minSize1='0' minSize2='0' ></AwSplitter>;
        if ( componentCanBeHidden( previousChild ) || componentCanBeHidden( child ) || componentCanBeNonExistent( previousChild ) || componentCanBeNonExistent( child ) ) {
            splitter =
                <AwSplitterShowWhen showWhen={componentShown( previousChild ) && componentShown( child ) && componentExist( previousChild ) && componentExist( child )}
                    className='aw-mfe-transparentSplitter' direction={splitterDirection} minSize1='0' minSize2='0' ></AwSplitterShowWhen>;
        }

        previousChild = child;
        return [ splitter, newChild ];
    } );
};

/**
 * Returns true if the component has a condition of visibility and can be hidden
 * @param {JSX.Element} component React component
 * @returns {Boolean} true if the component has a condition of visibility and can be hidden
 */
const componentCanBeHidden = ( component ) => {
    return component.props.hasOwnProperty( 'showWhen' );
};

/**
 * Returns true if the component is visible (by it's condition)
 * @param {JSX.Element} component React component
 * @returns {Boolean} true if the component is visible (by it's condition)
 */
const componentShown = ( component ) => {
    if ( component.props.hasOwnProperty( 'showWhen' ) ) {
        return component.props.showWhen;
    }
    return true;
};

/**
 * Returns true if the component has a condition of exist-when and can be non existent
 * @param {JSX.Element} component React component
 * @returns {Boolean} true if the component has a condition of exist-when and can be non existent
 */
const componentCanBeNonExistent = ( component ) => {
    return component.props.hasOwnProperty( 'existWhen' );
};

/**
 * Returns true if the component exists (by it's condition)
 * @param {JSX.Element} component React component
 * @returns {Boolean} true if the component exists (by it's condition)
 */
const componentExist = ( component ) => {
    if ( component.props.hasOwnProperty( 'existWhen' ) ) {
        return component.props.existWhen;
    }
    return true;
};

/**
 * Clone the element
 * @param {JSX.Element} element element to clone
 * @param {Object} overiddenProps props to override
 * @returns {JSX.Element} react component
 */
const cloneElement = ( element, overiddenProps ) => {
    return <element.type {...element.props} {...overiddenProps}>{element.props.children}</element.type>;
};
