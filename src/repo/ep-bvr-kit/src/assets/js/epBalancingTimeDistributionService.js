// Copyright (c) 2022 Siemens
/*eslint-disable jsx-a11y/click-events-have-key-events*/
/*eslint-disable jsx-a11y/no-static-element-interactions*/

/*global
 */

/**
 * Service for rendering EpBalancingTimeDistributionView
 *
 * @module js/epBalancingTimeDistributionService
 */

// LEFTOVERS: popup big icon, titles (scope name, production program name), filter by product variant

import AwIcon from 'viewmodel/AwIconViewModel';
import typeDisplayNameService from 'js/typeDisplayName.service';
import epBalancingProductVariantsService from 'js/epBalancingProductVariantsService';
import eventBus from 'js/eventBus';
import _ from 'lodash';

let root = undefined;
let renderingData = undefined;

const Z_INDEX_BASE = 10000;
const CYCLE_TIME_MARGIN_WIDTH = 6;
const MIN_BUBBLE_SIZE = 10;
const MIN_SCALE_ABSOLUTE_LEFT = 438;

/**
 * @param {*} elementRefList ref items
 */
export function initialize( elementRefList ) {
    root = elementRefList.get( 'root' ).current;
}

let bubbleSelection = undefined;
let bubbleTooltip = undefined;
let mouse = undefined;

/**
 */
export function destroy() {
    root = undefined;
    renderingData = undefined;
}

/**
 * @param {*} props context for render function interpolation
 * @returns {JSX.Element} react component
 */
export function epBalancingTimeDistributionRender( props ) {
    bubbleSelection = props.fields.bubbleSelection;
    bubbleTooltip = props.fields.bubbleTooltip;
    mouse = props.fields.mouse;
    return (
        <div className='aw-epBalancing-tdViewMainPanel'  ref={props.elementRefList.get( 'root' )}>
            {renderToolbar()}
            {props.viewModel.stations.length > 0 && renderChart( props.viewModel.stations )}
        </div>
    );
}

/**
 * Set selected ProductVariant to filter the station or process resource operations by
 */
function setSelectedProductVariant() {
    eventBus.publish( 'mfeLargePopup.closeRequest' );
    epBalancingProductVariantsService.setSelectedProductVariant( bubbleSelection.productVariant.modelObject.uid );
}

const renderToolbar = () => {
    return (
        <div className='aw-epBalancing-tdViewToolbarContainer'>
            <div className='aw-epBalancing-tdToolbarMainPanel'>
                {bubbleSelection.selected && <div className='aw-epBalancing-tdToolbarPvInformation'>
                    <span className='aw-epBalancing-tdToolbarPvIndication'></span>
                    <span><strong>{typeDisplayNameService.instance.getDisplayName( bubbleSelection.productVariant.modelObject )}</strong></span>
                    <span> probability </span>
                    <span><strong>{bubbleSelection.productVariant.probability}%</strong></span>
                </div>}
                <div className='aw-epBalancing-tdToolbarFilterButtonPanel'>
                    <button onClick={setSelectedProductVariant} disabled={!bubbleSelection.selected} className={'aw-epBalancing-tdToolbarFilterButton ' +
                        ( !bubbleSelection.selected ? 'aw-epBalancing-tdToolbarFilterButtonDisabled disabled' : 'aw-epBalancing-tdToolbarFilterButtonEnabled' )}>
                    Filter Balancing by Selected Variant</button>
                </div>
            </div>
        </div>
    );
};

const calculatRendering = ( stations ) => {
    const times = _.reduce( stations, ( result, station ) => {
        const prTimes = _.reduce( station.processResources, ( prResult, processResource ) => {
            return _.concat( prResult, _.map( processResource.productVariants, productVariant => productVariant.time ) );
        }, [] );

        return _.concat( result, station.taktTime, station.cycleTime, prTimes );
    }, [] );
    const probabilities = _.reduce( stations, ( result, station ) => {
        const prProbabilities = _.reduce( station.processResources, ( prResult, processResource ) => {
            return _.concat( prResult, _.map( processResource.productVariants, productVariant => productVariant.probability ) );
        }, [] );

        return _.concat( result, prProbabilities );
    }, [] );
    const minTime = _.min( times );
    const maxTime = _.max( times );
    const minProbability = _.min( probabilities );
    const maxProbability = _.max( probabilities );
    const width = root.getBoundingClientRect().width - 660;
    const height = 80;
    const maxBubbleSize = height - 10;

    let convertSizeRatio = 1;
    let convertLeftRatio = 1;
    const minUiLeft =  maxBubbleSize / 2;
    const maxUiLeft =  width - maxBubbleSize / 2;
    if( ( maxProbability > maxBubbleSize || minProbability < MIN_BUBBLE_SIZE ) &&
                                maxProbability !== minProbability ) {
        convertSizeRatio = ( maxBubbleSize - MIN_BUBBLE_SIZE ) /
                                    ( maxProbability - minProbability );
    }

    convertLeftRatio = maxUiLeft - minUiLeft;
    //to avoid division by 0
    if( maxTime !== minTime ) {
        convertLeftRatio /= maxTime - minTime;
    }

    const gridLines = [];
    const range = maxUiLeft - minUiLeft;
    const numberOfLines = Math.floor( range / 100 );
    const difference = ( range - 1 ) / numberOfLines;

    for ( let index = 0; index <= numberOfLines; index++ ) {
        gridLines.push( minUiLeft + difference * index );
    }

    renderingData = {
        minTime,
        maxTime,
        minProbability,
        maxProbability,
        maxBubbleSize,
        minUiLeft,
        maxUiLeft,
        convertSizeRatio,
        convertLeftRatio,
        gridLines
    };
};

const renderChart = ( stations ) => {
    if ( stations.length > 0 ) {
        calculatRendering( stations );
    }
    return (
        <div className='aw-epBalancing-tdViewChartContainer'>
            <div className='aw-epBalancing-tdChartMainPanel'>
                {stations.length > 0 &&
                <div className='aw-epBalancing-tdChartChartLayout'>
                    {renderStations( stations )}
                    {renderScale()}
                </div>}
            </div>
        </div>
    );
};

const renderScale = () => {
    const getTimeIndicatorStyle = ()=>{
        if ( mouse.x >= MIN_SCALE_ABSOLUTE_LEFT && mouse.x <= MIN_SCALE_ABSOLUTE_LEFT + renderingData.maxUiLeft - renderingData.minUiLeft ) {
            const left = mouse.x - MIN_SCALE_ABSOLUTE_LEFT + renderingData.minUiLeft;
            return {
                display: 'block',
                left
            };
        }
        return {};
    };

    const getTimeIndicatorText =  () => {
        const diff = mouse.x - MIN_SCALE_ABSOLUTE_LEFT;
        const actualValue = diff / renderingData.convertLeftRatio + renderingData.minTime;
        return Math.round( actualValue );
    };
    return (
        <div className='aw-epBalancing-tdChartScaleAndMessageContainer'>
            <div className='aw-epBalancing-tdScaleScaleAndMessageLine'>
                <div className='aw-epBalancing-tdScaleScaleLeftSpaceHolder'></div>
                <div className='aw-epBalancing-tdScaleUnassignedMessage'>Unassigned operations are not considered</div>
                <div className='aw-epBalancing-tdScaleScaleContainer'>
                    <div className='aw-epBalancing-tdScaleScaleText' style={{ left: renderingData.minUiLeft }}>{renderingData.minTime}</div>
                    <div className='aw-epBalancing-tdScaleScaleLine' style={{ left: renderingData.minUiLeft, width: renderingData.maxUiLeft - renderingData.minUiLeft }}></div>
                    <div className='aw-epBalancing-tdScaleScaleText' style={{ left: renderingData.maxUiLeft }}>{renderingData.maxTime}</div>
                    <div className='aw-epBalancing-tdScaleTimeIndicator' style={getTimeIndicatorStyle()}>
                        <div className='aw-epBalancing-tdScaleTimeIndicatorTriangle'></div>
                        <div className='aw-epBalancing-tdScaleTimeIndicatorText'>{getTimeIndicatorText()} sec</div>
                    </div>
                </div>
                <div className='aw-epBalancing-tdScaleScaleRightSpaceHolder'></div>
            </div>
        </div>
    );
};

const mouseMovedOnStations = ( e ) => {
    mouse.update( { x: e.clientX } );
};

const mouseLeftStations = () => {
    mouse.update( { x: 0 } );
};

const renderStations = ( stations ) => {
    return (
        <div className='aw-epBalancing-tdChartStationsContainer'>
            <div className='aw-epBalancing-tdChartStationsInnerContainer'
                onMouseMove={mouseMovedOnStations} onMouseLeave={mouseLeftStations}>
                {stations.map( station => renderStation( station ) )}
            </div>
        </div>
    );
};

const renderStation = ( { taktTime, modelObject, processResources } ) => {
    const stationName = typeDisplayNameService.instance.getDisplayName( modelObject );
    return (
        <div  key={modelObject.uid} className='aw-epBalancing-tdStationMainPanel'>
            <div className='aw-epBalancing-tdStationLabelContainer'>
                <div className='aw-epBalancing-tdStationLabel' title={stationName}>{stationName}</div>
            </div>
            {renderProcessResources( taktTime, processResources )}
        </div>
    );
};

const renderProcessResources = ( taktTime, processResources ) => {
    return (
        <div className='aw-epBalancing-tdStationProcessResourcesContainer'>
            {processResources.map( processResource => renderProcessResource( taktTime, processResource ) )}
        </div>
    );
};

const renderProcessResource = ( taktTime, { modelObject, productVariants, weighted } ) => {
    const pvsTimes = _.map( productVariants, pvData => pvData.time );
    const min = _.min( pvsTimes );
    const max = _.max( pvsTimes );
    const processResourceName = typeDisplayNameService.instance.getDisplayName( modelObject );
    return (
        <div key={modelObject.uid} className='aw-epBalancing-tdProcessResourceMainPanel'>
            <div className='aw-epBalancing-tdProcessResourceData'>
                <div className='aw-epBalancing-tdProcessResourceNameAndIcon'>
                    {modelObject.props.elb0sharedWithStations.dbValues && modelObject.props.elb0sharedWithStations.dbValues.length > 1 && <AwIcon iconId='cmdShare24'></AwIcon>}
                    <div className='aw-epBalancing-tdProcessResourceName mfgGeneralUI-text-ellipses' title={processResourceName}>{processResourceName}</div>
                </div>
                <div className='aw-epBalancing-tdProcessResourceWeighted'>Weighted: {weighted} sec</div>
                <div className='aw-epBalancing-tdProcessResourceMinMax'>Min: {min} sec | Max: {max} sec</div>
            </div>
            <div className='aw-epBalancing-tdProcessResourceBubblesAndGridLinesContainer'>
                {renderGridLines()}
                {renderBubbles( taktTime, modelObject, productVariants )}
            </div>
            {renderTimes( taktTime, productVariants )}
        </div>
    );
};

const renderGridLines = () => {
    return (
        <div className='aw-epBalancing-tdProcessResourceGridLinesContainer'>
            {renderingData.gridLines.map( ( gridLine, index ) =>
                <div key={index} className='aw-epBalancing-tdProcessResourceGridLine' style={{ left: gridLine }}></div> )}
        </div>
    );
};

const renderBubbles = ( taktTime, processResource, productVariants ) => {
    _.forEach( productVariants, productVariant => productVariant.transitionSpeed = Math.random().toFixed( 1 ) );
    return (
        <div className='aw-epBalancing-tdProcessResourceBubblesContainer'>
            <div className='aw-epBalancing-tdBubblesMainPanel'>
                { productVariants.map( productVariant => renderBubble( processResource, productVariant ) )}

                <div className='aw-epBalancing-tdBubblesCycleTimeContainer' style={{ left: calculateLeft( taktTime, CYCLE_TIME_MARGIN_WIDTH ) }}>
                    <div className='aw-epBalancing-tdBubblesCycleTime'></div>
                    <div className='aw-epBalancing-tdBubblesCycleTimeTooltip'>{taktTime}</div>
                </div>
            </div>
        </div>
    );
};

const bubbleClicked = ( processResource, productVariant ) => {
    if ( bubbleSelection.selected && bubbleSelection.processResource === processResource && bubbleSelection.productVariant.modelObject.uid === productVariant.modelObject.uid ) {
        bubbleSelection.update( { selected: false, processResource: '', productVariant: '' } );
    } else {
        bubbleSelection.update( { selected: true, processResource, productVariant } );
    }
};

const bubbleEntered = ( e, processResource, productVariant ) => {
    const { top, left, width } = e.target.getBoundingClientRect();
    bubbleTooltip.update( { processResource:processResource.uid, productVariant: productVariant.modelObject.uid, top, left, width } );
};

const bubbleLeft = () => {
    bubbleTooltip.update( { processResource:'', productVariant: '', top: NaN, left: NaN, width: NaN } );
};

const renderBubble = ( processResource, productVariant ) => {
    const size = calculateSize( productVariant.probability );
    const left = calculateLeft(  productVariant.time, size / 2  );
    let bubbleSelectionClass = '';
    if ( bubbleSelection.selected && bubbleSelection.productVariant.modelObject.uid === productVariant.modelObject.uid ) {
        if ( bubbleSelection.processResource === processResource.uid ) {
            bubbleSelectionClass = 'aw-epBalancing-tdBubblesBubbleSelected';
        } else {
            bubbleSelectionClass = 'aw-epBalancing-tdBubblesBubbleHighlighted';
        }
    }
    const showTooltip = bubbleTooltip.processResource === processResource.uid && bubbleTooltip.productVariant === productVariant.modelObject.uid;
    return (
        <div key={productVariant.modelObject.uid}  className='aw-epBalancing-tdBubblesBubbleWrapper' style={{ width: size, left }}>
            <div className={'aw-epBalancing-tdBubblesBubble ' + bubbleSelectionClass}
                style={{
                    zIndex: parseInt( Z_INDEX_BASE - productVariant.probability * 100 ),
                    transitionDuration: productVariant.transitionSpeed * 2 + 's',
                    transitionDelay: productVariant.transitionSpeed + 's',
                    height: size,
                    width: size,
                    left
                }} onClick={() => bubbleClicked( processResource.uid, productVariant )}
                onMouseEnter={e => bubbleEntered( e, processResource, productVariant )} onMouseLeave={bubbleLeft}></div>
            {showTooltip && <div className='aw-epBalancing-tdBubblesBubbleTooltip' style={{
                top: bubbleTooltip.top - 25,
                left: bubbleTooltip.left,
                marginLeft: -15 + bubbleTooltip.width / 2
            }}>
                <div className='aw-epBalancing-tdBubblesBubbleTooltipText'>
                    <span className='aw-epBalancing-tdBubblesBubbleTooltipPvName'>{typeDisplayNameService.instance.getDisplayName( productVariant.modelObject )}</span>
                    <span className='aw-epBalancing-tdBubblesBubbleTooltipSeparator'>|</span>
                    <span>{productVariant.time} sec, {productVariant.probability}%</span>
                </div>
                <div className='aw-epBalancing-tdBubblesBubbleTooltipTriangle'></div>
            </div>}
        </div>
    );
};


const renderTimes = ( taktTime, productVariants ) => {
    const getPvTime = () => {
        return _.filter( productVariants, { modelObject: { uid: bubbleSelection.productVariant.modelObject.uid } } )[0].time;
    };

    const showDeviation = () => taktTime !== getPvTime();
    const getDeviationText = () => {
        const pvTime = getPvTime();
        const sign = taktTime > pvTime ? '-' : '+';
        let difference = Math.abs( taktTime - pvTime );
        difference = taktTime ? ( difference * 100 / taktTime ).toFixed( 2 ) : difference.toFixed( 2 );
        return String( sign ) + parseFloat( difference );
    };

    return (
        <div className='aw-epBalancing-tdProcessResourceTimesContainer'>
            {bubbleSelection.selected && <div className='aw-epBalancing-tdTimesMainPanel'>
                <div className='aw-epBalancing-tdTimesLine'>
                    <AwIcon iconId='cmdTime'></AwIcon>
                    <div className='aw-epBalancing-tdTimesTimeText'>{getPvTime()} sec</div>
                    {showDeviation && <div className='aw-epBalancing-tdTimesDeviationText'>({getDeviationText()}%)</div>}
                </div>
            </div>}
        </div>
    );
};

const calculateLeft = ( value, marginLeft ) => {
    return ( value - renderingData.minTime ) * renderingData.convertLeftRatio + renderingData.minUiLeft - marginLeft;
};


const calculateSize = ( value ) => {
    return ( value - renderingData.minProbability ) * renderingData.convertSizeRatio + MIN_BUBBLE_SIZE;
};
