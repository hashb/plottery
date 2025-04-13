from flask import Flask, render_template, request, jsonify
import os

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/send_job', methods=['POST'])
def send_job():
    # This is a stub function that would send the job to the plotter
    gcode = request.json.get('gcode', '')
    # For now, just return success and the first few lines for confirmation
    return jsonify({
        'status': 'success',
        'message': 'Job sent to plotter',
        'preview': '\n'.join(gcode.split('\n')[:5]) + '...' if gcode else 'No G-code provided'
    })

if __name__ == '__main__':
    app.run(debug=True)
