// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * Service for rendering EpBalancingProcessResourceTile
 *
 * @module js/epBalancingOperationSequenceService
 */

import eventBus from 'js/eventBus';
import AwIcon from 'viewmodel/AwIconViewModel';
import epBalancingOperationSequenceUtils from 'js/epBalancingOperationsSequenceUtils';
import $ from 'jquery';
import epBalancingLabelsService from 'js/epBalancingLabelsService';

let root = undefined;
let size = undefined;

const PORT_OFFSET = epBalancingOperationSequenceUtils.UI_CONSTANTS.PORT_SIZE / 2 + 1;
const CONTAINER_ID = 'BalancingPageSingleStation';

/**
 * @param {*} elementRefList ref items
 */
export function initialize( elementRefList ) {
    root = elementRefList.get( 'root' ).current;
    updateSize();
}

/**
 */
export function destroy() {
    root = undefined;
    $( window ).off( 'resize', resize );
    eventBus.unsubscribe( 'aw-splitter-update', handleContainerResize );
    eventBus.unsubscribe( 'appCtx.update', handleProductBOPToggle );
}

const resize = () => {
    size.update( { width: root.getBoundingClientRect().width } );
};

const handleContainerResize = ( splitter ) => {
    if( splitter.area1.id === CONTAINER_ID || splitter.area2.id === CONTAINER_ID ) {
        resize();
    }
};

const handleProductBOPToggle = ( eventData ) => {
    if( eventData.name === 'ep.balancingShowProductBOP' ) {
        resize();
    }
};

const updateSize = () => {
    if( root ) {
        resize();
        $( window ).on( 'resize', resize );
        eventBus.subscribe( 'aw-splitter-update', handleContainerResize );
        eventBus.subscribe( 'appCtx.update', handleProductBOPToggle );
    }
};

/**
 * @param {*} props context for render function interpolation
 * @returns {JSX.Element} react component
 */
export function epBalancingOperationSequenceRender( props ) {
    //console.log( root );
    size = props.fields.size;
    return (
        <div className='aw-epBalancing-priRoot' ref={props.elementRefList.get( 'root' )}>
            {props.viewModel.station && props.viewModel.processResources && props.viewModel.processResources.length > 0 && renderChart( props )}
        </div>
    );
}

// todo:
// localizations
// tooltips
const renderChart = ( props ) => {
    const processResources = props.viewModel.processResources;
    const data = epBalancingOperationSequenceUtils.prepareContainers( props.viewModel.station, processResources );
    const svgWrapperWidth = props.fields.size.width - 240;
    const actualWidth = svgWrapperWidth - 2;
    const scalingRatio = svgWrapperWidth * 0.75 / data.taktTime;
    const rendering = epBalancingOperationSequenceUtils.recalculateData( data, scalingRatio, 'Operator {0} Time:', actualWidth );
    rendering.svgWrapperWidth = svgWrapperWidth;
    return (
        <div className='aw-epBalancing-priPanelWrapper'>
            {renderProcessResourcesContainer( data )}
            {renderSVG( data, rendering )}
        </div>
    );
};

const renderProcessResourcesContainer = ( data ) => {
    return (
        <div className='mfgGeneralUI-container-absoluteContainer'>
            {data.containers.map( container => renderProcessResource( container ) )}
        </div>
    );
};

const renderProcessResource = ( container ) => {
    return (
        <div key={container.id} className='aw-epBalancing-priContainer' style={{ top: container.y }}>

            <div className='aw-epBalancing-priNamePanel'>
                {container.shared && <AwIcon iconId='cmdShare24'></AwIcon>}
                <div className='aw-epBalancing-priName aw-epBalancing-textEllipses'>{container.name}</div>
                {container.capacity < 100 && <div className='aw-epBalancing-priContainerCapacity'> | {container.capacity}%</div>}
            </div>
            <div className='aw-epBalancing-priTimePanel'>
                <AwIcon iconId='cmdTime'></AwIcon>
                <div className='aw-epBalancing-priTime'>{epBalancingLabelsService.stringToFloat( container.time ) }</div>
            </div>
        </div>
    );
};

// I skipped {renderItemWrappers()} - this is for drag and drop
const renderSVG = ( data, rendering ) => {
    return (
        <div className='aw-epBalancing-priSvgWrapper'>
            <svg className='aw-epBalancing-priSvg' style={{ width: rendering.svgWrapperWidth, height: data.containers.length * 50 + 20 }}>
                {renderDefs()}
                {renderContainers( data )}
                {renderItems( data )}
                {renderArrows( data )}
                {renderIndicatorLines( data, rendering.positions )}
            </svg>
        </div>
    );
};

const renderDefs = () => {
    return (
        <defs>
            <marker id='existingArrowHead' refX='0' refY='5' markerWidth='5' markerHeight='9'>
                <path d='M0,0 L0,9 L5,4.5 z'
                    className='aw-epBalancing-priArrowHead aw-epBalancing-priExistingArrowHead'></path>
            </marker>
            <marker id='hoveredArrowHead' refX='0' refY='5' markerWidth='5' markerHeight='9'>
                <path d='M0,0 L0,9 L5,4.5 z'
                    className='aw-epBalancing-priArrowHead aw-epBalancing-priHoveredArrowHead'></path>
            </marker>
            <marker id='selectedArrowHead' refX='0' refY='5' markerWidth='5' markerHeight='9'>
                <path d='M0,0 L0,9 L5,4.5 z'
                    className='aw-epBalancing-priArrowHead aw-epBalancing-priSelectedArrowHead'></path>
            </marker>
            <marker id='axis' refX='0' refY='6' markerWidth='1' markerHeight='11'>
                <line x1='1' x2='1' y1='0' y2='11' className='aw-epBalancing-priAxisLine'></line>
            </marker>
            <path id='externalArrowHead' d='M 0 0 L 6 5.5 L 0 11 Z' className='aw-epBalancing-priExternalArrowHead'>
            </path>
        </defs>
    );
};

const renderContainers = ( data ) => {
    return (
        <g>
            {data.containers.map( container =>
                <line key={container.id} className='aw-epBalancing-priContainerAxis'
                    x1={container.axisX1} x2={container.axisX2}
                    y1={container.axisY} y2={container.axisY}
                    markerEnd='url(#axis)' markerStart='url(#axis)'>
                </line>
            )}
        </g>
    );
};

// I remove: item selection
const renderItems = ( data ) => {
    return (
        <g>
            {data.containers.map( container =>
                container.items.map( item =>
                    <g key={item.id}>
                        <rect className={'aw-epBalancing-priItem ' + ( item.external ? 'aw-epBalancing-priExternalItem' : '' )}
                            x={item.x} y={item.y} width={item.width} height={item.height}>
                        </rect>

                        {!item.valid && <rect className='aw-epBalancing-priExceedingItem'
                            x={item.x} y={item.y} width={item.width} height={3}>
                        </rect>}
                        {item.external && item.hasExternalFlow && item.hasWaitTimeBefore &&
                        <g>
                            <use href='#externalArrowHead' y={container.y + 15} x={item.x}></use>
                            {item.hover && <line className='aw-epBalancing-priExternalArrow' x1={item.x - 5}
                                x2={item.x} y1={container.y + 21}
                                y2={container.y + 21}>
                            </line>}
                        </g>}
                    </g>
                )
            )}
            {data.containers.map( container =>
                container.gaps.map( gap =>
                    <g key={gap.id}>
                        <rect className='aw-epBalancing-priGap' x={gap.x} y={gap.y}
                            width={gap.width} height='26px'></rect>
                        <line className='aw-epBalancing-priGapBorder' x1={gap.x}
                            x2={gap.x + gap.width} y1={gap.y + 1} y2={gap.y + 1}></line>
                        <line className='aw-epBalancing-priGapBorder' x1={gap.x}
                            x2={gap.x + gap.width} y1={gap.y + 26} y2={gap.y + 26}></line>
                        {gap.start === 0 && <line className='aw-epBalancing-priGapBorder' x1={gap.x + 1}
                            x2={gap.x + 1} y1={gap.y} y2={gap.y + 26}></line>}
                    </g>
                )
            )}
            {data.containers.map( container =>
                container.items.map( item =>
                    <g key={item.id}>
                        {item.inport.visible && <rect className='aw-epBalancing-priPort'
                            width='7px' height='7px'
                            transform={`translate(${item.inport.x} ${item.inport.y - PORT_OFFSET}) rotate(45)`} />}
                        {item.outport.visible && <rect className='aw-epBalancing-priPort'
                            width='7px' height='7px'
                            transform={`translate(${item.outport.x} ${item.outport.y - PORT_OFFSET}) rotate(45)`} />}
                    </g>
                )
            )}
        </g>
    );
};

/*
I skipped:

<!-- Invisible hovered arrow -->
<!-- Invisible selected arrow -->
<!-- Invisible selection for existing arrows -->
<!-- Current drawing arrow -->

*/
const renderArrows = ( data ) => {
    return (
        <g>
            {data.arrows.map( arrow =>
                <path key={arrow.id}
                    className='aw-epBalancing-priArrow aw-epBalancing-priExistingArrow' d={arrow.d}
                    markerEnd='url(#existingArrowHead)' />
            )}
        </g>
    );
};

//<text 
const renderIndicatorLines = ( data, rendering ) => {
    return (
        <g className='aw-epBalancing-priIndicatorLines'>
            <g>
                {data.containers.map( container =>
                    <g key={container.id}>
                        <line className={container.capacity < 100 ? 'aw-epBalancing-priSecondaryTaktTimeLine' : 'aw-epBalancing-priMainTaktTimeLine'}
                            x1={rendering.taktTimeX} x2={rendering.taktTimeX}
                            y1={container.axisY - 35} y2={container.axisY + 5} />
                        {rendering.taktTimeX && container.capacity < 100 &&
                            <g>
                                <line className='aw-epBalancing-priMainTaktTimeLine'
                                    x1={rendering.taktTimeX * container.capacity / 100}
                                    x2={rendering.taktTimeX * container.capacity / 100}
                                    y1={container.axisY - 35} y2={container.axisY + 5} />
                                <line className='aw-epBalancing-priLineOverlay'
                                    x1={rendering.taktTimeX * container.capacity / 100}
                                    x2={rendering.taktTimeX * container.capacity / 100}
                                    y1={container.axisY - 35} y2={container.axisY + 5}>
                                    <title>Process Resource Takt Time: {container.taktTime}</title>
                                </line>
                            </g>}
                        <text
                            className={container.availableTime < 0 ? 'aw-epBalancing-priExceedingTime' : 'aw-epBalancing-priAvailableTime'}
                            y={container.nameY}
                            x={container.availableTimeX}>{epBalancingLabelsService.stringToFloat( container.availableTime )}
                        </text>
                    </g>
                )}
                <line className='aw-epBalancing-priLineOverlay' x1={rendering.taktTimeX}
                    x2={rendering.taktTimeX} y1={rendering.indicatorLineStart}
                    y2={rendering.indicatorLineEnd}>
                    <title>Station Takt time: {epBalancingLabelsService.stringToFloat( data.taktTime )} sec
                    </title>
                </line>
                <text className='aw-epBalancing-priTaktTimeText' x={rendering.taktTimeTextX}
                    y={rendering.indicatorLineEnd + 15}>{epBalancingLabelsService.stringToFloat( data.taktTime )}
                    <title>Station Takt time: {epBalancingLabelsService.stringToFloat( data.taktTime )} sec
                    </title>
                </text>
            </g>
            <g className={data.cycleTime > data.taktTime ? 'aw-epBalancing-priCycleTimeExceeding' : 'aw-epBalancing-priCycleTimeNormal'}>
                <line className='aw-epBalancing-priCycleTimeLine' x1={rendering.cycleTimeX}
                    x2={rendering.cycleTimeX} y1={rendering.indicatorLineStart}
                    y2={rendering.indicatorLineEnd}>
                </line>
                <line className='aw-epBalancing-priLineOverlay' x1={rendering.cycleTimeX}
                    x2={rendering.cycleTimeX} y1={rendering.indicatorLineStart}
                    y2={rendering.indicatorLineEnd}>
                    <title>Cycle time: {epBalancingLabelsService.stringToFloat( data.cycleTime )} sec
                    </title>
                </line>
                <text x={rendering.cycleTimeTextX}
                    y={rendering.indicatorLineEnd + 15}>{epBalancingLabelsService.stringToFloat( data.cycleTime )}
                    <title>Cycle time: {epBalancingLabelsService.stringToFloat( data.cycleTime )} sec
                    </title>
                </text>
            </g>
        </g>
    );
};
