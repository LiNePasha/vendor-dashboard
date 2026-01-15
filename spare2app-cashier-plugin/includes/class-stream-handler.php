<?php
/**
 * Stream Handler Class - Real-time updates via Server-Sent Events
 * 
 * Provides real-time product updates to POS clients
 * 
 * @package Spare2App_Cashier
 * @version 1.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

class Spare2App_Stream_Handler {
    
    private $tracker;
    
    public function __construct() {
        $this->tracker = new Spare2App_Changes_Tracker();
    }
    
    /**
     * Start SSE stream
     */
    public function start_stream($request) {
        $vendor_id = $request['vendor_id'];
        
        // Set headers for SSE
        header('Content-Type: text/event-stream');
        header('Cache-Control: no-cache');
        header('Connection: keep-alive');
        header('X-Accel-Buffering: no'); // Disable nginx buffering
        
        // Prevent timeout
        @set_time_limit(0);
        @ini_set('max_execution_time', 0);
        
        // Send initial connection message
        $this->send_event(array(
            'type' => 'connection',
            'message' => 'Connected to Cashier API',
            'vendor_id' => $vendor_id,
            'timestamp' => current_time('Y-m-d\TH:i:s\Z', true)
        ));
        
        $last_check = current_time('timestamp');
        $iteration = 0;
        
        // Keep connection alive
        while (true) {
            // Check for changes
            $changes = $this->tracker->get_changes_since($vendor_id, $last_check);
            
            if (!empty($changes)) {
                foreach ($changes as $change) {
                    // Send each change as separate event
                    $this->send_event(array(
                        'type' => 'product_change',
                        'action' => $change->change_type,
                        'product_id' => $change->product_id,
                        'data' => json_decode($change->change_data, true),
                        'timestamp' => $change->changed_at
                    ));
                }
            }
            
            // Send heartbeat every 30 seconds
            if ($iteration % 6 === 0) {
                $this->send_event(array(
                    'type' => 'heartbeat',
                    'timestamp' => current_time('Y-m-d\TH:i:s\Z', true)
                ));
            }
            
            $last_check = current_time('timestamp');
            $iteration++;
            
            // Flush output
            if (ob_get_level() > 0) {
                ob_flush();
            }
            flush();
            
            // Wait 5 seconds before next check
            sleep(5);
            
            // Check if connection is still alive
            if (connection_aborted()) {
                error_log("🔌 SSE connection closed for vendor {$vendor_id}");
                break;
            }
        }
        
        exit;
    }
    
    /**
     * Send SSE event
     */
    private function send_event($data) {
        echo "data: " . json_encode($data) . "\n\n";
    }
}
