-- Database Views for B-Seva Platform
-- These views provide optimized read access for reporting and analytics

-- View: Active Priests with Performance Metrics
CREATE OR REPLACE VIEW vw_active_priests AS
SELECT 
    u.id,
    u.name,
    u.email,
    u.phone,
    pp.languages,
    pp.specializations,
    pp.experience_years,
    pp.rating,
    pp.total_reviews,
    pp.total_bookings,
    pp.is_verified,
    pp.is_available,
    pp.city,
    pp.state,
    pp.created_at
FROM users u
INNER JOIN priest_profiles pp ON u.id = pp.user_id
WHERE u.role = 'priest' 
  AND u.is_active = true
  AND pp.is_verified = true;

-- View: Customer Summary with Booking Stats
CREATE OR REPLACE VIEW vw_customer_summary AS
SELECT 
    u.id,
    u.name,
    u.email,
    u.phone,
    cp.city,
    cp.state,
    cp.total_bookings,
    cp.total_spent,
    cp.created_at,
    cp.last_booking_date,
    CASE 
        WHEN cp.last_booking_date >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 'Active'
        WHEN cp.last_booking_date >= DATE_SUB(NOW(), INTERVAL 90 DAY) THEN 'Recent'
        ELSE 'Inactive'
    END as customer_status
FROM users u
INNER JOIN customer_profiles cp ON u.id = cp.user_id
WHERE u.role = 'customer' AND u.is_active = true;

-- View: Booking Details with All Related Information
CREATE OR REPLACE VIEW vw_booking_details AS
SELECT 
    b.id as booking_id,
    b.booking_number,
    b.status,
    b.booking_date,
    b.puja_date,
    b.puja_time,
    b.total_amount,
    b.commission_amount,
    b.payment_status,
    -- Customer Info
    cu.id as customer_id,
    cu.name as customer_name,
    cu.email as customer_email,
    cu.phone as customer_phone,
    -- Priest Info
    pu.id as priest_id,
    pu.name as priest_name,
    pu.phone as priest_phone,
    pp.rating as priest_rating,
    -- Puja Type Info
    pt.name as puja_name,
    pt.duration_hours,
    sc.name as category_name,
    -- Location
    b.location_address,
    b.location_city,
    b.location_state,
    b.location_pincode,
    -- Temple (if applicable)
    t.name as temple_name,
    -- Timestamps
    b.created_at,
    b.updated_at
FROM bookings b
INNER JOIN users cu ON b.customer_id = cu.id
LEFT JOIN users pu ON b.priest_id = pu.id
LEFT JOIN priest_profiles pp ON pu.id = pp.user_id
INNER JOIN puja_types pt ON b.puja_type_id = pt.id
INNER JOIN service_categories sc ON pt.category_id = sc.id
LEFT JOIN temples t ON b.temple_id = t.id;

-- View: Revenue Analytics by Month
CREATE OR REPLACE VIEW vw_monthly_revenue AS
SELECT 
    DATE_FORMAT(b.puja_date, '%Y-%m') as month,
    COUNT(*) as total_bookings,
    SUM(b.total_amount) as gross_revenue,
    SUM(b.commission_amount) as platform_revenue,
    SUM(b.total_amount - b.commission_amount) as priest_payout,
    AVG(b.total_amount) as avg_booking_value,
    COUNT(DISTINCT b.customer_id) as unique_customers,
    COUNT(DISTINCT b.priest_id) as active_priests
FROM bookings b
WHERE b.status IN ('confirmed', 'completed')
  AND b.payment_status = 'completed'
GROUP BY DATE_FORMAT(b.puja_date, '%Y-%m')
ORDER BY month DESC;

-- View: Priest Performance Metrics
CREATE OR REPLACE VIEW vw_priest_performance AS
SELECT 
    p.user_id as priest_id,
    u.name as priest_name,
    COUNT(b.id) as total_bookings,
    COUNT(CASE WHEN b.status = 'completed' THEN 1 END) as completed_bookings,
    COUNT(CASE WHEN b.status = 'cancelled' THEN 1 END) as cancelled_bookings,
    AVG(r.rating) as avg_rating,
    COUNT(r.id) as total_reviews,
    SUM(b.total_amount - b.commission_amount) as total_earnings,
    MAX(b.puja_date) as last_booking_date,
    DATEDIFF(NOW(), MAX(b.puja_date)) as days_since_last_booking
FROM priest_profiles p
INNER JOIN users u ON p.user_id = u.id
LEFT JOIN bookings b ON p.user_id = b.priest_id
LEFT JOIN reviews r ON b.id = r.booking_id
WHERE u.is_active = true
GROUP BY p.user_id, u.name;

-- View: Popular Services
CREATE OR REPLACE VIEW vw_popular_services AS
SELECT 
    pt.id as puja_type_id,
    pt.name as puja_name,
    sc.name as category_name,
    COUNT(b.id) as total_bookings,
    AVG(b.total_amount) as avg_price,
    AVG(r.rating) as avg_rating,
    COUNT(r.id) as total_reviews,
    pt.base_price,
    pt.duration_hours
FROM puja_types pt
INNER JOIN service_categories sc ON pt.category_id = sc.id
LEFT JOIN bookings b ON pt.id = b.puja_type_id
LEFT JOIN reviews r ON b.id = r.booking_id
GROUP BY pt.id, pt.name, sc.name, pt.base_price, pt.duration_hours
ORDER BY total_bookings DESC;

-- View: Samagri Inventory Status
CREATE OR REPLACE VIEW vw_samagri_inventory AS
SELECT 
    s.id,
    s.name,
    s.category,
    s.unit,
    s.current_stock,
    s.min_stock_level,
    s.unit_price,
    s.current_stock * s.unit_price as inventory_value,
    CASE 
        WHEN s.current_stock <= s.min_stock_level THEN 'Low Stock'
        WHEN s.current_stock <= s.min_stock_level * 2 THEN 'Medium Stock'
        ELSE 'Adequate Stock'
    END as stock_status,
    s.supplier_name,
    s.last_restocked_date,
    DATEDIFF(NOW(), s.last_restocked_date) as days_since_restock
FROM samagri_items s
WHERE s.is_active = true
ORDER BY 
    CASE 
        WHEN s.current_stock <= s.min_stock_level THEN 1
        WHEN s.current_stock <= s.min_stock_level * 2 THEN 2
        ELSE 3
    END,
    s.name;

-- View: Upcoming Bookings
CREATE OR REPLACE VIEW vw_upcoming_bookings AS
SELECT 
    b.id,
    b.booking_number,
    b.puja_date,
    b.puja_time,
    b.status,
    cu.name as customer_name,
    cu.phone as customer_phone,
    pu.name as priest_name,
    pu.phone as priest_phone,
    pt.name as puja_name,
    b.location_city,
    b.total_amount,
    DATEDIFF(b.puja_date, CURDATE()) as days_until_puja
FROM bookings b
INNER JOIN users cu ON b.customer_id = cu.id
LEFT JOIN users pu ON b.priest_id = pu.id
INNER JOIN puja_types pt ON b.puja_type_id = pt.id
WHERE b.puja_date >= CURDATE()
  AND b.status IN ('confirmed', 'pending')
ORDER BY b.puja_date ASC, b.puja_time ASC;

-- View: Customer Lifetime Value
CREATE OR REPLACE VIEW vw_customer_ltv AS
SELECT 
    c.user_id as customer_id,
    u.name as customer_name,
    u.email,
    c.total_bookings,
    c.total_spent as lifetime_value,
    c.total_spent / NULLIF(c.total_bookings, 0) as avg_order_value,
    DATEDIFF(NOW(), c.created_at) as days_as_customer,
    c.total_spent / NULLIF(DATEDIFF(NOW(), c.created_at), 0) * 365 as annualized_value,
    c.last_booking_date,
    DATEDIFF(NOW(), c.last_booking_date) as days_since_last_booking,
    CASE 
        WHEN c.total_bookings >= 5 THEN 'VIP'
        WHEN c.total_bookings >= 3 THEN 'Loyal'
        WHEN c.total_bookings >= 2 THEN 'Repeat'
        ELSE 'New'
    END as customer_tier
FROM customer_profiles c
INNER JOIN users u ON c.user_id = u.id
WHERE u.is_active = true
ORDER BY lifetime_value DESC;

-- View: Temple Utilization
CREATE OR REPLACE VIEW vw_temple_utilization AS
SELECT 
    t.id as temple_id,
    t.name as temple_name,
    t.city,
    t.state,
    COUNT(b.id) as total_bookings,
    COUNT(CASE WHEN b.puja_date >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as bookings_last_30_days,
    SUM(b.total_amount) as total_revenue,
    AVG(r.rating) as avg_rating,
    COUNT(r.id) as total_reviews,
    t.capacity,
    t.is_active
FROM temples t
LEFT JOIN bookings b ON t.id = b.temple_id
LEFT JOIN reviews r ON b.id = r.booking_id
GROUP BY t.id, t.name, t.city, t.state, t.capacity, t.is_active
ORDER BY total_bookings DESC;
