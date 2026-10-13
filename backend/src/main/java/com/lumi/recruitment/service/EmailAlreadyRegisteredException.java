package com.lumi.recruitment.service;

public class EmailAlreadyRegisteredException extends RuntimeException {
    public EmailAlreadyRegisteredException() {
        super("Email đã được sử dụng. Vui lòng đăng nhập hoặc dùng email khác.");
    }
}
