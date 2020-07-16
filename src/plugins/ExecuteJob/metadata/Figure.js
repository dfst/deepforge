/* globals define */
define([
    './Metadata',
], function(
    Metadata,
) {
    class Figure extends Metadata {
        async update(state) {
            this.core.setAttribute(this.node, 'title', state.title);
            await this.clearSubGraphs();

            state.axes.forEach(axes => {
                const axesNode = this.core.createNode({
                    parent: this.node,
                    base: axes.is3D ? this.META.Plot3D : this.META.Plot2D
                });
                this.setAxesProperties(axesNode, axes);
                this.addAxesLines(axesNode, this.node, axes);
                if(!axes.is3D){
                    this.addAxesImage(axesNode, this.node, axes);
                }
                this.addAxesScatterPoints(axesNode, this.node, axes);
            });
        }

        setAxesProperties(axesNode, axes){
            this.core.setAttribute(axesNode, 'title', axes.title);
            this.core.setAttribute(axesNode, 'xlabel', axes.xlabel);
            this.core.setAttribute(axesNode, 'ylabel', axes.ylabel);
            this.core.setAttribute(axesNode, 'xlim', axes.xlim);
            this.core.setAttribute(axesNode, 'ylim', axes.ylim);
            if(axes.is3D){
                this.core.setAttribute(axesNode, 'zlabel', axes.zlabel);
                this.core.setAttribute(axesNode, 'zlim', axes.zlim);
            }
        }

        addAxesLines(parent, job, axes) {
            axes.lines.forEach((line, index) => {
                const lineNode = this.core.createNode({
                    parent: parent,
                    base: this.META.Line
                });
                this.core.setAttribute(lineNode, 'color', line.color);
                this.core.setAttribute(lineNode, 'label', line.label || `line ${index + 1}`);
                this.core.setAttribute(lineNode, 'lineStyle', line.lineStyle);
                this.core.setAttribute(lineNode, 'marker', line.marker);
                const points = line.points.map(pts => pts.join(',')).join(';');
                this.core.setAttribute(lineNode, 'points', points);
                this.core.setAttribute(lineNode, 'lineWidth', line.lineWidth);
            });
        }

        async clearSubGraphs() {
            const subGraphs = await this.loadChildren();

            subGraphs.forEach(subGraph => this.core.deleteNode(subGraph));
        }

        addAxesImage(parent, job, axes) {
            axes.images.forEach(image => {
                const imageNode = this.core.createNode({
                    parent: parent,
                    base: this.META.Image
                });
                this.core.setAttribute(imageNode, 'rgbaMatrix', image.rgbaMatrix);
                this.core.setAttribute(imageNode, 'height', image.height);
                this.core.setAttribute(imageNode, 'width', image.width);
                this.core.setAttribute(imageNode, 'visible', image.visible);
                this.core.setAttribute(imageNode, 'numChannels', image.numChannels);
            });
        }

        addAxesScatterPoints (parent, job, axes) {
            axes.scatterPoints.forEach(scatterPoint => {
                const scatterPointsNode = this.core.createNode({
                    parent: parent,
                    base: this.META.ScatterPoints,
                });
                this.core.setAttribute(scatterPointsNode, 'color', scatterPoint.color);
                this.core.setAttribute(scatterPointsNode, 'label', scatterPoint.label);
                this.core.setAttribute(scatterPointsNode, 'marker', scatterPoint.marker);
                const points = scatterPoint.points.map(pts => pts.join(',')).join(';');
                this.core.setAttribute(scatterPointsNode, 'points', points);
                this.core.setAttribute(scatterPointsNode, 'width', scatterPoint.width);
            });
        }

        static getCommand() {
            return 'PLOT';
        }

        static getMetaType() {
            return 'Graph';
        }

    }

    return Figure;
});
